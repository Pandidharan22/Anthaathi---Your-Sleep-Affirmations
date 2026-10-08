package com.pandidharan.anthaathi.neuraltts

import android.net.Uri
import android.os.SystemClock
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream

// Execution Plan step 3.13 (spike): Kokoro v1.0 via sherpa-onnx, fully on-device. Model files
// are downloaded by the JS layer, extracted here, then loaded from disk. Generation writes a
// normal WAV so the result flows through the same Library/Player path as everything else.

private class ModelNotLoadedException :
  CodedException(message = "The neural voice model is not loaded")

private class ModelLoadFailedException(reason: String?) :
  CodedException(message = "Failed to load the neural voice model: $reason")

private class SynthesisFailedException(reason: String) :
  CodedException(message = "Neural speech synthesis failed: $reason")

private class ExtractionFailedException(reason: String?) :
  CodedException(message = "Failed to extract the model archive: $reason")

class AnthaathiNeuralTtsModule : Module() {
  private var tts: OfflineTts? = null

  // The engine holds a native pointer and generation is CPU-bound; Expo may run async
  // functions concurrently, so all engine access is serialized.
  private val lock = Any()

  override fun definition() = ModuleDefinition {
    Name("AnthaathiNeuralTts")

    OnDestroy {
      synchronized(lock) {
        tts?.release()
        tts = null
      }
    }

    AsyncFunction("extractTarBz2") { archivePath: String, destDir: String ->
      try {
        extractTarBz2(toFile(archivePath), toFile(destDir))
      } catch (e: CodedException) {
        throw e
      } catch (e: Exception) {
        throw ExtractionFailedException(e.message)
      }
    }

    // Hashing ~350 MB in JS would take minutes; streamed here it takes seconds.
    AsyncFunction("sha256") { path: String ->
      val digest = MessageDigest.getInstance("SHA-256")
      FileInputStream(toFile(path)).use { input ->
        val buffer = ByteArray(1 shl 20)
        while (true) {
          val read = input.read(buffer)
          if (read < 0) break
          digest.update(buffer, 0, read)
        }
      }
      digest.digest().joinToString("") { "%02x".format(it) }
    }

    AsyncFunction("load") { modelDir: String, numThreads: Int ->
      synchronized(lock) {
        val dir = toFile(modelDir)
        val config = OfflineTtsConfig(
          model = OfflineTtsModelConfig(
            kokoro = OfflineTtsKokoroModelConfig(
              model = File(dir, "model.onnx").path,
              voices = File(dir, "voices.bin").path,
              tokens = File(dir, "tokens.txt").path,
              dataDir = File(dir, "espeak-ng-data").path,
              lexicon = File(dir, "lexicon-us-en.txt").path,
            ),
            numThreads = numThreads,
            provider = "cpu",
          ),
        )
        val start = SystemClock.elapsedRealtime()
        tts?.release()
        tts = null
        val engine = try {
          OfflineTts(config = config)
        } catch (e: Throwable) {
          // Throwable, not Exception: on a device without the native library (32-bit ARM,
          // x86) System.loadLibrary throws UnsatisfiedLinkError, an Error. It must surface as
          // a normal rejection the UI can explain, never crash the app.
          throw ModelLoadFailedException(e.message)
        }
        tts = engine
        mapOf(
          "loadMs" to (SystemClock.elapsedRealtime() - start),
          "sampleRate" to engine.sampleRate(),
          "numSpeakers" to engine.numSpeakers(),
        )
      }
    }

    AsyncFunction("synthesizeToFile") { text: String, outputPath: String, speakerId: Int, speed: Double ->
      synchronized(lock) {
        val engine = tts ?: throw ModelNotLoadedException()
        val out = toFile(outputPath)
        out.parentFile?.mkdirs()
        val start = SystemClock.elapsedRealtime()
        val audio = engine.generate(text = text, sid = speakerId, speed = speed.toFloat())
        val synthMs = SystemClock.elapsedRealtime() - start
        if (audio.samples.isEmpty()) throw SynthesisFailedException("no audio was generated")
        if (!audio.save(out.path)) {
          out.delete()
          throw SynthesisFailedException("could not write ${out.path}")
        }
        mapOf(
          "outputPath" to outputPath,
          "durationMs" to (audio.samples.size * 1000L / audio.sampleRate),
          "synthMs" to synthMs,
        )
      }
    }

    AsyncFunction("unload") {
      synchronized(lock) {
        tts?.release()
        tts = null
      }
    }
  }

  // JS passes `file://` URIs (expo-file-system's convention); java.io.File needs a plain path.
  private fun toFile(pathOrUri: String): File {
    val path = if (pathOrUri.startsWith("file://")) {
      Uri.parse(pathOrUri).path ?: pathOrUri.removePrefix("file://")
    } else {
      pathOrUri
    }
    return File(path)
  }

  private fun extractTarBz2(archive: File, destDir: File): Int {
    destDir.mkdirs()
    val root = destDir.canonicalFile
    var files = 0
    BZip2CompressorInputStream(BufferedInputStream(FileInputStream(archive), 1 shl 16)).use { bz ->
      TarArchiveInputStream(bz).use { tar ->
        var entry = tar.nextEntry
        while (entry != null) {
          val target = File(root, entry.name).canonicalFile
          // Refuse entries that would escape the destination ("zip slip").
          if (target != root && !target.path.startsWith(root.path + File.separator)) {
            throw ExtractionFailedException("unsafe entry path ${entry.name}")
          }
          when {
            entry.isDirectory -> target.mkdirs()
            entry.isFile -> {
              target.parentFile?.mkdirs()
              target.outputStream().buffered(1 shl 16).use { tar.copyTo(it) }
              files++
            }
            else -> Unit // links/devices: none are needed for the model
          }
          entry = tar.nextEntry
        }
      }
    }
    return files
  }
}
