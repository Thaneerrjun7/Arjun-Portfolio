import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getFirestore, collection, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyBBN2TVsOhm2zQ8-3X9x07HZiJagQXfmmg',
  authDomain: 'portfolio-2-d32d9.firebaseapp.com',
  projectId: 'portfolio-2-d32d9',
  storageBucket: 'portfolio-2-d32d9.firebasestorage.app',
  messagingSenderId: '1077343289579',
  appId: '1:1077343289579:web:4fa7971bb3ae29a81ebeae',
}));

const grid = document.querySelector('.projects-grid');
const navStatus = document.querySelector('.nav-status .status-text');
const statusBox = document.querySelector('.status-box .status-text');
const cards = new Map();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function safeUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const { protocol } = new URL(url, location.href);
    return protocol === 'http:' || protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

const normalize = (text) => text.replace(/\s+/g, ' ').trim();

function createCard(id) {
  const card = el('div', 'project-card tilt-card animate-on-scroll');
  card.dataset.animation = 'scale-up';
  card.dataset.id = id;
  const inner = el('div', 'project-card-inner');
  inner.append(el('div', 'project-shine'), el('div', 'project-image-wrapper'), el('div', 'project-info'));
  card.append(inner);
  return card;
}

function fillCard(card, project) {
  const media = card.querySelector('.project-image-wrapper');
  const imageSrc = safeUrl(project.image?.src);
  media.classList.toggle('project-image-gradient', !imageSrc);
  if (imageSrc) {
    const img = media.querySelector('.project-image') ?? el('img', 'project-image');
    if (img.getAttribute('src') !== imageSrc) img.src = imageSrc;
    img.alt = project.image.alt ?? project.title ?? '';
    media.replaceChildren(img);
  } else {
    media.replaceChildren(el('div', 'project-icon', project.icon ?? '✨'));
  }

  const info = [];
  if (project.badge) info.push(el('div', 'project-badge', project.badge));
  info.push(el('h3', 'project-title', project.title ?? ''));
  if (project.description) info.push(el('p', 'project-desc', project.description));
  if (project.tech?.length) {
    const tech = el('div', 'project-tech');
    tech.append(...project.tech.map((name) => el('span', null, name)));
    info.push(tech);
  }
  if (project.stat) info.push(el('div', 'project-stat', project.stat));
  const links = (project.links ?? []).filter((link) => safeUrl(link.href));
  if (links.length) {
    const row = el('div', 'project-links');
    for (const link of links) {
      const a = el('a', 'project-link', link.label ?? link.href);
      a.href = link.href;
      if (/^https?:/i.test(link.href)) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      row.append(a);
    }
    info.push(row);
  }
  card.querySelector('.project-info').replaceChildren(...info);
}

function flash(card) {
  card.classList.remove('live-updated');
  void card.offsetWidth; // restart the glow if it's already running
  card.classList.add('live-updated');
}

// Reuse the matching built-in cards so the first live render doesn't flicker or replay their entrance.
function adoptBuiltInCards(docs) {
  const idsByTitle = new Map(docs.map((d) => [d.get('title'), d.id]));
  for (const card of grid.querySelectorAll('.project-card')) {
    const id = idsByTitle.get(normalize(card.querySelector('.project-title')?.textContent ?? ''));
    if (id && !cards.has(id)) {
      card.dataset.id = id;
      cards.set(id, card);
    } else {
      card.remove();
    }
  }
}

function renderProjects(snapshot) {
  if (snapshot.empty) return;
  if (cards.size === 0) adoptBuiltInCards(snapshot.docs);

  const fresh = [];
  for (const change of snapshot.docChanges()) {
    const { id } = change.doc;
    if (change.type === 'removed') {
      cards.get(id)?.remove();
      cards.delete(id);
      continue;
    }
    let card = cards.get(id);
    if (!card) {
      card = createCard(id);
      cards.set(id, card);
      fresh.push(card);
    }
    fillCard(card, change.doc.data());
    if (change.type === 'modified') flash(card);
  }

  const order = (d) => d.get('order') ?? Infinity;
  [...snapshot.docs].sort((a, b) => order(a) - order(b)).forEach((d, index) => {
    const card = cards.get(d.id);
    if (grid.children[index] !== card) grid.insertBefore(card, grid.children[index] ?? null);
  });

  for (const card of fresh) {
    if (window.portfolioFX) {
      window.portfolioFX.tilt(card);
      window.portfolioFX.observe(card);
    } else {
      card.classList.add('visible');
    }
  }
}

function statusNodes(paragraphs) {
  const nodes = [];
  paragraphs.forEach((text, i) => {
    if (i > 0) nodes.push(el('br'), el('br'));
    text.split('**').forEach((part, j) => nodes.push(j % 2 ? el('strong', null, part) : document.createTextNode(part)));
  });
  return nodes;
}

// Starts from the current opacity so an update arriving mid-fade continues smoothly instead of jumping.
async function crossfade(target, apply) {
  const from = getComputedStyle(target).opacity;
  target.getAnimations().forEach((animation) => animation.cancel());
  const fadeOut = target.animate([{ opacity: from }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
  try {
    await fadeOut.finished;
  } catch {
    return; // a newer update took over
  }
  apply();
  target.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
  fadeOut.cancel();
}

let shownNav = normalize(navStatus?.textContent ?? '');
let shownStatus = normalize(statusBox?.textContent ?? '');

function renderStatus(snapshot) {
  if (!snapshot.exists()) return;
  const { navText, paragraphs } = snapshot.data();

  if (navStatus && navText && normalize(navText) !== shownNav) {
    shownNav = normalize(navText);
    crossfade(navStatus, () => { navStatus.textContent = navText; });
  }

  if (statusBox && paragraphs?.length) {
    const text = normalize(paragraphs.join(' ').replaceAll('**', ''));
    if (text !== shownStatus) {
      shownStatus = text;
      crossfade(statusBox, () => statusBox.replaceChildren(...statusNodes(paragraphs)));
    }
  }
}

const domReady = new Promise((resolve) => {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resolve, { once: true });
  else resolve();
});

const onError = (error) => console.warn('Live content unavailable, keeping the built-in content:', error);

domReady.then(() => {
  onSnapshot(collection(db, 'projects'), renderProjects, onError);
  onSnapshot(doc(db, 'site', 'status'), renderStatus, onError);
});
