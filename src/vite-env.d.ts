/// <reference types="vite/client" />

// Déclaration pour les imports CSS
declare module '*.css' {
  const content: string;
  export default content;
}
