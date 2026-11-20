/** Public account shape safe to send to the browser (never includes secrets). */
export interface AppUser {
  id: string;
  username: string;
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
  countryName: string;
  createdAt: string;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface SignUpCredentials extends AuthCredentials {
  country: string;
}

export interface AuthResponse {
  token: string;
  user: AppUser;
}
