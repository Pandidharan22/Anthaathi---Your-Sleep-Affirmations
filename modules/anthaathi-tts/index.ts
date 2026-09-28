// Re-export the native module. On web, it will be resolved to AnthaathiTtsModule.web.ts
// and on native platforms to AnthaathiTtsModule.ts
export { default } from './src/AnthaathiTtsModule';
export * from './src/AnthaathiTts.types';
