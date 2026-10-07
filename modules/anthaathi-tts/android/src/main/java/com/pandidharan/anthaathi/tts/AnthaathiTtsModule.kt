package com.pandidharan.anthaathi.tts

import android.net.Uri
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.io.File
import java.util.UUID
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// ADR-0007 / Execution Plan step 3.6: wraps Android's TextToSpeech.synthesizeToFile()
// so AI Guided affirmations can be generated once and saved as a normal playable file,
// reusing the same Library/Player as a self-recorded affirmation from that point on.

private class TtsInitFailedException :
  CodedException(message = "The on-device text-to-speech engine failed to initialize")

private class TtsSynthesisFailedException :
  CodedException(message = "On-device speech synthesis failed")

private class TtsBusyException :
  CodedException(message = "A synthesis request is already in progress")

private class TtsVoiceNotFoundException(voiceId: String) :
  CodedException(message = "No voice found with identifier '$voiceId'")

class AnthaathiTtsModule : Module() {
  private var tts: TextToSpeech? = null
  private var initFailed = false

  // TextToSpeech.setOnUtteranceProgressListener replaces the whole listener per call, so a
  // second request while one is still in flight would silently orphan the first request's
  // Promise (it would never resolve or reject). Rejecting outright is simpler and safer than
  // queueing for this step's scope -- callers are expected to await one synthesis at a time.
  private var pendingUtteranceId: String? = null

  override fun definition() = ModuleDefinition {
    Name("AnthaathiTts")

    OnDestroy {
      tts?.shutdown()
      tts = null
    }

    AsyncFunction("listVoices") { promise: Promise ->
      initIfNeeded { success ->
        if (!success) {
          promise.reject(TtsInitFailedException())
        } else {
          listVoices(promise)
        }
      }
    }

    AsyncFunction("synthesizeToFile") { text: String, outputPath: String, voiceId: String, rate: Double, pitch: Double, promise: Promise ->
      if (pendingUtteranceId != null) {
        promise.reject(TtsBusyException())
        return@AsyncFunction
      }
      initIfNeeded { success ->
        if (!success) {
          promise.reject(TtsInitFailedException())
        } else {
          synthesize(text, outputPath, voiceId, rate.toFloat(), pitch.toFloat(), promise)
        }
      }
    }
  }

  private fun initIfNeeded(onReady: (Boolean) -> Unit) {
    val existing = tts
    if (existing != null) {
      onReady(!initFailed)
      return
    }
    val context = appContext.reactContext
    if (context == null) {
      onReady(false)
      return
    }
    tts = TextToSpeech(context) { status ->
      initFailed = status != TextToSpeech.SUCCESS
      onReady(!initFailed)
    }
  }

  // The rest of this app always deals in `file://`-prefixed URIs (expo-file-system's
  // convention), but java.io.File needs a plain filesystem path -- passing the URI straight
  // through would silently create a broken relative path instead of the intended file.
  private fun resolveOutputFile(outputPath: String): File {
    val path = if (outputPath.startsWith("file://")) {
      Uri.parse(outputPath).path ?: outputPath.removePrefix("file://")
    } else {
      outputPath
    }
    return File(path)
  }

  // Android's Voice class has no gender field -- this returns every field the platform
  // actually provides and leaves any male/female curation to the JS layer, which needs real
  // per-device voice data (names, locales) to do that sensibly rather than guessing here.
  private fun listVoices(promise: Promise) {
    val engine = tts
    if (engine == null) {
      promise.reject(TtsInitFailedException())
      return
    }
    val voices = (engine.voices ?: emptySet()).map { voice ->
      mapOf(
        "identifier" to voice.name,
        "locale" to voice.locale.toLanguageTag(),
        "quality" to voice.quality,
        "latency" to voice.latency,
        "isNetworkConnectionRequired" to voice.isNetworkConnectionRequired,
        "features" to voice.features.toList(),
      )
    }
    promise.resolve(voices)
  }

  private fun synthesize(
    text: String,
    outputPath: String,
    voiceId: String,
    rate: Float,
    pitch: Float,
    promise: Promise,
  ) {
    val engine = tts
    if (engine == null) {
      promise.reject(TtsInitFailedException())
      return
    }

    val voice = engine.voices?.find { it.name == voiceId }
    if (voice == null) {
      promise.reject(TtsVoiceNotFoundException(voiceId))
      return
    }
    engine.voice = voice
    // Both persist on the engine instance, so they are set on every request rather than assumed.
    engine.setSpeechRate(rate)
    engine.setPitch(pitch)

    val outFile = resolveOutputFile(outputPath)
    outFile.parentFile?.mkdirs()

    val utteranceId = UUID.randomUUID().toString()
    pendingUtteranceId = utteranceId

    engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
      override fun onStart(utteranceIdParam: String?) {}

      override fun onDone(utteranceIdParam: String?) {
        if (utteranceIdParam != utteranceId) return
        pendingUtteranceId = null
        promise.resolve(outputPath)
      }

      @Deprecated("Deprecated in the Android SDK -- onError(String, Int) carries the error code")
      override fun onError(utteranceIdParam: String?) {
        onError(utteranceIdParam, -1)
      }

      override fun onError(utteranceIdParam: String?, errorCode: Int) {
        if (utteranceIdParam != utteranceId) return
        pendingUtteranceId = null
        outFile.delete()
        promise.reject(TtsSynthesisFailedException())
      }
    })

    val result = engine.synthesizeToFile(text, Bundle(), outFile, utteranceId)
    if (result != TextToSpeech.SUCCESS) {
      pendingUtteranceId = null
      promise.reject(TtsSynthesisFailedException())
    }
  }
}
