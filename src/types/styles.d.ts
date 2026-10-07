/**
 * Metro and react-native-web process CSS imports at build time, so no runtime
 * module exists for them. This declaration keeps `import './global.css'`
 * type-safe without pulling in a CSS loader type package.
 */
declare module '*.css';