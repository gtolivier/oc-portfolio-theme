/* The CSS estimates the header's height for a menu on a single row; when the
   menu wraps, the header is taller. Publish its real height. */
const siteHeader = document.querySelector('.site-header');
if (siteHeader) {
  new ResizeObserver(([entry]) => {
    /* Safari before 15.4 has no borderBoxSize, and older Firefox gives an object instead of an array. */
    const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--header-height', `${height}px`);
  }).observe(siteHeader, { box: 'border-box' });
}
