import 'react';

declare module '*.css' {}

declare module 'react' {
  interface HTMLAttributes<T> {
    vid?: string;
  }
  interface SVGAttributes<T> {
    vid?: string;
  }
}
