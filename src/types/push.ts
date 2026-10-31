export type PushRegistrationResult =
  | { status: 'granted'; message?: string }
  | { status: 'denied'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string };
