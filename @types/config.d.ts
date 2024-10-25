declare module 'config' {
  interface Config {
    [key: string]: any;
  }

  interface ConfigStatic {
    get<T>(key: string): T;
  }

  const config: ConfigStatic;
  export default config;
}
