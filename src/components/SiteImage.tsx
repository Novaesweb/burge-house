import React from 'react';

export function SiteImage({ src, onError, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} src={src || '/food-placeholder.svg'} onError={event => {
    onError?.(event);
    if (!event.currentTarget.src.endsWith('/food-placeholder.svg')) {
      event.currentTarget.src = '/food-placeholder.svg';
    }
  }} />;
}
