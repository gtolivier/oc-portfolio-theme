/* The key figures of the background section show 0 until the section comes into view, then count
   up to their value. With JavaScript, a 0 is drawn over each value, which stays in the page,
   invisible, for assistive technologies and to keep the figure's width; once counted, the 0 goes
   and the value shows. Without JavaScript, the page shows the full values. */
import { reducedMotionQuery } from './reduced-motion';

const COUNT_MS = 1000;
const section = document.querySelector<HTMLElement>('.background');
const values = Array.from(document.querySelectorAll<HTMLElement>('.background-stats dt'));

type KeyFigure = { value: HTMLElement; zero: HTMLElement; target: number };

const prepare = (value: HTMLElement): KeyFigure => {
  const fullValue = document.createElement('span');
  fullValue.className = 'figure-value';
  fullValue.textContent = value.textContent;
  const zero = document.createElement('span');
  zero.className = 'figure-zero';
  zero.setAttribute('aria-hidden', 'true');
  zero.textContent = '0';
  value.replaceChildren(fullValue, zero);
  return { value, zero, target: parseInt(fullValue.textContent ?? '', 10) };
};

const finish = ({ value, zero }: KeyFigure): void => {
  zero.remove();
  value.classList.add('is-counted');
};

const countUp = (figures: KeyFigure[]): void => {
  if (reducedMotionQuery().matches) {
    figures.forEach(finish);
    return;
  }
  const start = performance.now();
  const step = (now: number): void => {
    const progress = Math.min((now - start) / COUNT_MS, 1);
    for (const figure of figures) {
      figure.zero.textContent = String(Math.round(figure.target * progress));
    }
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      figures.forEach(finish);
    }
  };
  requestAnimationFrame(step);
};

if (section && values.length > 0 && !reducedMotionQuery().matches) {
  const figures = values.map(prepare);
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      countUp(figures);
    }
  });
  observer.observe(section);
}
