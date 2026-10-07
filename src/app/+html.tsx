import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

const DESCRIPTION =
  'Monitoreo de sismos en tiempo real, mapa de zonas de riesgo y alertas de emergencia.';

/**
 * Web-only document shell for the preview. Metro/react-native-web inject the
 * bundle automatically; this file only owns the HTML skeleton and metadata.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0B1120" />
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:title" content="sismoConnect" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content={DESCRIPTION} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'body { background-color: #0B1120; }' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}