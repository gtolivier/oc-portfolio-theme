/* The key figures of the background section show 0 until each figure comes into view, then count
   up to their value. With JavaScript, a 0 is drawn over each value, which stays in the page,
   invisible, for assistive technologies and to keep the figure's width; once counted, the 0 goes
   and the value shows. Without JavaScript, or when the visitor asks for reduced motion, at load
   or during the count, the page shows the full values. */
import { reducedMotionQuery } from './reduced-motion';

const COUNT_MS = 1500;
/* Fast at first, slowing down as it nears the value. */
const easeOut = (progress: number): number => 1 - Math.pow(1 - progress, 3);
const terms = Array.from(document.querySelectorAll<HTMLElement>('.background-stats dt'));
const reducedMotion = reducedMotionQuery();

type KeyFigure = { term: HTMLElement; zero: HTMLElement; target: number };

const prepare = (term: HTMLElement): KeyFigure => {
  const fullValue = document.createElement('span');
  fullValue.className = 'figure-value';
  fullValue.textContent = term.textContent;
  const zero = document.createElement('span');
  zero.className = 'figure-zero';
  zero.setAttribute('aria-hidden', 'true');
  zero.textContent = '0';
  term.replaceChildren(fullValue, zero);
  return { term, zero, target: parseInt(fullValue.textContent ?? '', 10) };
};

const finish = ({ term, zero }: KeyFigure): void => {
  zero.remove();
  term.classList.add('is-counted');
};

const countUp = (figures: KeyFigure[]): void => {
  const start = performance.now();
  const step = (now: number): void => {
    if (reducedMotion.matches) {
      figures.forEach(finish);
      return;
    }
    const progress = Math.max(Math.min((now - start) / COUNT_MS, 1), 0);
    for (const figure of figures) {
      figure.zero.textContent = String(Math.round(figure.target * easeOut(progress)));
    }
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      figures.forEach(finish);
    }
  };
  step(start);
};

if (terms.length > 0 && !reducedMotion.matches) {
  const figureOfTerm = new Map<Element, KeyFigure>(terms.map((term) => [term, prepare(term)]));
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting);
    visible.forEach((entry) => observer.unobserve(entry.target));
    if (visible.length > 0) {
      countUp(visible.flatMap((entry) => figureOfTerm.get(entry.target) ?? []));
    }
  });
  terms.forEach((term) => observer.observe(term));
}
