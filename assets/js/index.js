'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const branches = window.LinusBranches;
  const I18n = window.LinusI18n;
  const T = source => I18n.t(source);
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const wheel = $('#wheel');
  const imageStage = $('#imageStage');
  const initialPhoto = imageStage.querySelector('.photo');
  if (initialPhoto) {
    const hideBrokenPhoto = () => {
      if (!initialPhoto.naturalWidth) initialPhoto.style.visibility = 'hidden';
    };
    initialPhoto.addEventListener('error', hideBrokenPhoto, { once: true });
    if (initialPhoto.complete) hideBrokenPhoto();
  }
  const heading = $('#branchHeading');
  const details = $('#branchDetails');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const desktop = matchMedia('(min-width:721px)');
  const count = branches.length;
  const elements = [];
  let position = 0;
  let targetPosition = 0;
  let selectedIndex = 0;
  let animation = 0;
  let frameTime = 0;
  let wheelTimer = 0;
  let contentTimer = 0;
  let imageToken = 0;
  let toastTimer = 0;
  const drag = {
    active: false, id: null, y: 0, start: 0, moved: false, pressed: null
  };
  branches.forEach((branch, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wheel-item';
    button.textContent = T(branch.name);
    button.dataset.index = String(i);
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(i === 0));
    button.tabIndex = -1;
    wheel.append(button);
    elements.push(button);
  });
  function rowHeight() {
    return (parseFloat(getComputedStyle(elements[0]).fontSize) || 30) * 1.55;
  }
  function paint() {
    const height = rowHeight();
    const angleStep = Math.PI * 8 / 180;
    const radius = height / angleStep;
    elements.forEach((element, i) => {
      const distance = i - position;
      const angle = clamp(distance * angleStep, -Math.PI / 2, Math.PI / 2);
      const x = -radius * (1 - Math.cos(angle)) * 1.15;
      const y = radius * Math.sin(angle);
      const rotation = angle * 180 / Math.PI;
      element.style.transform = `translate3d(${x.toFixed(2)}px,calc(${y.toFixed(2)}px - 50%),0) rotate(${rotation.toFixed(2)}deg)`;
      element.style.opacity = Math.max(.08, 1 - Math.abs(distance) * .31).toFixed(3);
      element.style.filter = `blur(${(Math.abs(distance) * 1.4).toFixed(2)}px)`;
    });
  }
  function stop() {
    if (animation) cancelAnimationFrame(animation); animation = 0;
  }
  function animate(now) {
    const dt = Math.min((now - frameTime) / 1000, .05);
    frameTime = now;
    position += (targetPosition - position) * (1 - Math.exp(-dt / (reduced.matches ? .015 : .16)));
    if (Math.abs(targetPosition - position) < .0005) position = targetPosition;
    paint();
    animation = position !== targetPosition ? requestAnimationFrame(animate) : 0;
  }
  function start() {
    stop(); frameTime = performance.now(); animation = requestAnimationFrame(animate);
  }
  function select(index) {
    const next = clamp(index, 0, count - 1);
    if (next === selectedIndex) return;
    selectedIndex = next;
    update(next);
  }
  function goTo(value) {
    targetPosition = clamp(Math.round(value), 0, count - 1);
    select(targetPosition);
    start();
  }
  function animated(value) {
    targetPosition = clamp(value, 0, count - 1);
    select(Math.round(targetPosition));
    start();
  }
  function direct(value) {
    position = targetPosition = clamp(value, 0, count - 1);
    select(Math.round(position));
    paint();
  }
  wheel.addEventListener('pointerdown', event => {
    if (drag.active || (event.pointerType === 'mouse' && event.button !== 0)) return;
    clearTimeout(wheelTimer); stop(); targetPosition = position;
    Object.assign(drag, {
      active: true, id: event.pointerId, y: event.clientY, start: position, moved: false, pressed: event.target.closest('.wheel-item')?.dataset.index ?? null
    });
    wheel.setPointerCapture(event.pointerId);
    wheel.classList.add('dragging');
  });
  wheel.addEventListener('pointermove', event => {
    if (!drag.active || drag.id !== event.pointerId) return;
    const dy = event.clientY - drag.y;
    if (Math.abs(dy) > 5) drag.moved = true;
    if (drag.moved) direct(drag.start - dy / rowHeight());
  });
  function endDrag(event) {
    if (!drag.active || drag.id !== event.pointerId) return;
    const moved = drag.moved, pressed = drag.pressed, id = drag.id;
    drag.active = false; drag.id = null;
    wheel.classList.remove('dragging');
    if (wheel.hasPointerCapture(id)) wheel.releasePointerCapture(id);
    goTo(moved ? Math.round(position) : pressed === null ? selectedIndex : Number(pressed));
  }
  wheel.addEventListener('pointerup', endDrag);
  wheel.addEventListener('pointercancel', endDrag);
  wheel.addEventListener('lostpointercapture', endDrag);
  wheel.addEventListener('dragstart', event => event.preventDefault());
  wheel.addEventListener('wheel', event => {
    event.preventDefault();
    if (drag.active) return;
    const delta = event.deltaMode === 1 ? event.deltaY * 24 : event.deltaMode === 2 ? event.deltaY * wheel.clientHeight : event.deltaY;
    animated(targetPosition + clamp(delta / Math.max(rowHeight() * 1.5, 1), -.75, .75));
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => goTo(targetPosition), 120);
  }, {
    passive: false
  });
  document.addEventListener('keydown', event => {
    if (!desktop.matches || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || drag.active) return;
    if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]')) return;
    const delta = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
    if (!delta) return;
    event.preventDefault(); clearTimeout(wheelTimer); goTo(selectedIndex + delta);
  });
  wheel.addEventListener('keydown', event => {
    if (desktop.matches) return;
    const delta = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
    if (delta) {
      event.preventDefault(); goTo(selectedIndex + delta);
    }
  });
  const pinSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  const week = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bishkek', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const minutes = text => {
    const [hours, mins] = text.split(':').map(Number); return hours * 60 + mins;
  };
  const schedule = (branch, day) => branch.hours[(day === 0 || day === 6) ? 'weekend' : 'weekday'];
  function isOpen(branch) {
    const parts = formatter.formatToParts(new Date());
    const part = type => parts.find(x => x.type === type)?.value;
    const day = week.indexOf(part('weekday'));
    const now = Number(part('hour')) * 60 + Number(part('minute'));
    function inRange(value, range) {
      const start = minutes(range[0]); let end = minutes(range[1]);
      if (end <= start) end += 1440;
      return value >= start && value < end;
    }
    return inRange(now, schedule(branch, day)) || inRange(now + 1440, schedule(branch, (day + 6) % 7));
  }
  function render(branch) {
    $('#branchName').textContent = T(branch.name);
    $('#branchAddress').innerHTML = pinSvg;
    const address = document.createElement('span'); address.textContent = T(branch.address); $('#branchAddress').append(address);
    const menu = $('#menuList'); menu.replaceChildren();
    branch.popular.forEach(([name, price]) => {
      const row = document.createElement('div'); row.className = 'menu-item';
      const title = document.createElement('span'); title.className = 'menu-item-name'; title.textContent = name;
      const amount = document.createElement('span'); amount.className = 'menu-price mono'; amount.textContent = I18n.currency(price);
      row.append(title, amount); menu.append(row);
    });
    const hours = $('#hoursList'); hours.replaceChildren();
    [['ПН — ПТ', branch.hours.weekday], ['СБ — ВС', branch.hours.weekend]].forEach(([label, span]) => {
      const row = document.createElement('div'); row.className = 'hours-row';
      const day = document.createElement('span'); day.className = 'hours-day'; day.textContent = T(label);
      const time = document.createElement('span'); time.className = 'hours-time mono'; time.textContent = `${span[0]} — ${span[1]}`;
      row.append(day, time); hours.append(row);
    });
    const status = $('#hoursStatus'), open = isOpen(branch);
    status.textContent = T(open ? 'ОТКРЫТО СЕЙЧАС' : 'СЕЙЧАС ЗАКРЫТО'); status.classList.toggle('closed', !open);
  }
  function swapImage(branch) {
    const token = ++imageToken;
    const preload = new Image();
    const reveal = () => {
      if (token !== imageToken) return;
      const previous = [...imageStage.querySelectorAll('.photo')];
      const next = document.createElement('img'); next.className = 'photo'; next.src = branch.image; next.alt = T(branch.name);
      imageStage.append(next);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (token !== imageToken) {
          next.remove(); return;
        }
        next.classList.add('visible'); previous.forEach(img => img.classList.remove('visible'));
        setTimeout(() => previous.forEach(img => img.remove()), 1000);
      }));
    };
    preload.addEventListener('load', reveal, {
      once: true
    }); preload.src = branch.image;
    if (preload.complete && preload.naturalWidth) reveal();
  }
  function update(index) {
    const branch = branches[index];
    elements.forEach((b, i) => {
      b.classList.toggle('active', i === index); b.setAttribute('aria-selected', String(i === index));
    });
    const n = String(index + 1).padStart(2, '0');
    $('#counter').textContent = `${n} / 04`; $('#visualIndex').textContent = `${n} — 04`;
    swapImage(branch); clearTimeout(contentTimer);
    heading.classList.add('changing'); details.classList.add('changing');
    contentTimer = setTimeout(() => {
      render(branch); requestAnimationFrame(() => {
        heading.classList.remove('changing'); details.classList.remove('changing');
      });
    }, reduced.matches ? 0 : 180);
  }
  $('#confirm').addEventListener('click', () => {
    const branch = branches[selectedIndex];
    try {
      localStorage.setItem('linus.selectedRestaurant', branch.id);
    }
    catch {
    }
    window.location.href = `menu.html?location=${encodeURIComponent(branch.id)}`;
  });
  I18n.subscribe(() => {
    elements.forEach((element, i) => {
      element.textContent = T(branches[i].name);
    });
    render(branches[selectedIndex]); paint();
  });
  render(branches[0]); elements[0].classList.add('active'); paint();
  window.addEventListener('resize', paint); document.fonts.ready.then(paint);
  setInterval(() => render(branches[selectedIndex]), 60000);
})();
