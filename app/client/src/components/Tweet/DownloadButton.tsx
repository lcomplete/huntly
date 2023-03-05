import React from 'react';
import classNames from 'classnames';

export default function DownloadButton({src, className,order}: { src: string, className?: string,order?:number  }) {
  function handleClick() {

  }

  return (
    <a
      className={classNames(className, {
        'video-react-control': true,
        'video-react-button': true
      })}
      href={src}
      target={"_blank"}
      download
      style={{
        backgroundImage:
          'url(data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjRkZGRkZGIiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIxOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4gICAgPHBhdGggZD0iTTE5IDloLTRWM0g5djZINWw3IDcgNy03ek01IDE4djJoMTR2LTJINXoiLz4gICAgPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center'
      }}
      tabIndex={0}
      onClick={handleClick}
    />
  );
}