document.addEventListener('DOMContentLoaded', main);

// --- CONFIGURATION ---
const GIST_RAW_URL = 'https://gist.githubusercontent.com/Thomas-Marchand/427d44e917d26d6073378d81db84d5b2/raw/calendar_events.json';
const START_HOUR = 6;
const END_HOUR = 21;
const HOUR_HEIGHT = 60; // 60px per hour
const GROUP_SPECIFIC_COLORS = {
    "M1": "#4243a6",
    "M2": "#eb0909",
    "M1_ANDROIDE": "#ba0c50",
    "M2_ANDROIDE": "#bf1e9a",
    // "M1_BIM": "#??????",
    "M2_BIM": "#86c7ac",
    // "M1_DAC": "#??????",
    "M2_DAC": "#4c3553",
    // "M1_IMA": "#??????",
    "M2_IMA": "#2c2785",
    // "M1_IQ": "#??????",
    // "M2_IQ": "#??????",
};
const STALE_THRESHOLD_DAY_MIN = 15;
const STALE_THRESHOLD_NIGHT_MIN = 70;
const MOBILE_BREAKPOINT = 768;

// --- Global State ---
let allEvents = [], groupColors = {}, selectedGroups = [], scrapeMetadata = {}, currentDateOffset = 0, lastUpdatedInterval, currentTimeInterval;
let allUniqueGroups = [];
let currentView = 'daily';
let touchStartX = 0;
let touchStartY = 0;

// --- DOM Elements ---
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const calendarContainer = document.querySelector('.calendar-container');
const dailyViewBtn = document.getElementById('daily-view-btn');
const weeklyViewBtn = document.getElementById('weekly-view-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const lastUpdatedElement = document.getElementById('last-updated');
const collapsedSidebarInfo = document.getElementById('collapsed-sidebar-info');
// Popups
const popupOverlay = document.getElementById('popup-overlay');
const popupBox = document.getElementById('popup-box');
const popupCloseBtn = document.getElementById('popup-close-btn');
const eventDetailOverlay = document.getElementById('event-detail-overlay');
const eventDetailBox = document.getElementById('event-detail-box');
const eventDetailCloseBtn = document.getElementById('event-detail-close-btn');
const instructionOverlay = document.getElementById('instruction-overlay');
const instructionCloseBtn = document.getElementById('instruction-close-btn');


async function main() {
    // Event Listeners
    prevBtn.addEventListener('click', navigatePrevious);
    nextBtn.addEventListener('click', navigateNext);
    sidebarToggleBtn.addEventListener('click', toggleSidebar);
    dailyViewBtn.addEventListener('click', () => switchView('daily'));
    weeklyViewBtn.addEventListener('click', () => switchView('weekly'));
    
    // Popup Listeners
    popupCloseBtn.addEventListener('click', hidePopup);
    popupOverlay.addEventListener('click', hidePopup);
    popupBox.addEventListener('click', (e) => e.stopPropagation());
    eventDetailCloseBtn.addEventListener('click', hideEventDetail);
    eventDetailOverlay.addEventListener('click', hideEventDetail);
    eventDetailBox.addEventListener('click', (e) => e.stopPropagation());
    instructionCloseBtn.addEventListener('click', hideInstructionPopup);
    instructionOverlay.addEventListener('click', hideInstructionPopup);

    // Swipe Gesture Listeners
    calendarContainer.addEventListener('touchstart', handleTouchStart, false);
    calendarContainer.addEventListener('touchmove', handleTouchMove, false);
    calendarContainer.addEventListener('touchend', handleTouchEnd, false);

    initializeSidebarState();
    initializeViewState();

    try {
        const data = await fetchData(GIST_RAW_URL);
        allEvents = data.events;
        scrapeMetadata = data.meta;
        document.getElementById('loading-indicator').style.display = 'none';
        
        initializeGroups();
        renderCalendar();
        setupLastUpdatedTimer();
        setupCurrentTimeTimer();
        
        checkFirstVisit();

    } catch (error) {
        document.getElementById('loading-indicator').innerText = 'Failed to load calendar data.';
        console.error('Failed to initialize calendar:', error);
    }
}

function dateToYyyyMmDdString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function initializeViewState() {
    const savedView = localStorage.getItem('calendarView');
    if (savedView === 'weekly') {
        currentView = 'weekly';
    }
    updateViewButtons();
}

function switchView(newView) {
    if (newView === currentView) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxOffset = (scrapeMetadata.w - 1) * 7;
    let newOffset = currentDateOffset;
    if (newView === 'weekly') {
        const currentDay = new Date();
        currentDay.setDate(currentDay.getDate() + currentDateOffset);
        currentDay.setHours(0, 0, 0, 0);
        const dayOfWeek = currentDay.getDay();
        const difference = currentDay.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const mondayOfWeek = new Date(currentDay.setDate(difference));
        newOffset = Math.round((mondayOfWeek - today) / (1000 * 60 * 60 * 24));
    } else if (newView === 'daily') {
        const weekStartDate = new Date();
        weekStartDate.setDate(weekStartDate.getDate() + currentDateOffset);
        const dayOfWeek = weekStartDate.getDay();
        const difference = weekStartDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const mondayOfWeek = new Date(weekStartDate.setDate(difference));
        let targetDay = new Date(mondayOfWeek);
        const weekDateStrings = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(mondayOfWeek);
            d.setDate(d.getDate() + i);
            weekDateStrings.push(d.toISOString().split('T')[0].split('-').reverse().join('/'));
        }
        const eventsInWeek = allEvents
            .filter(e => selectedGroups.includes(e.g) && weekDateStrings.includes(e.sd))
            .sort((a,b) => a.sd.split('/').reverse().join('-').localeCompare(b.sd.split('/').reverse().join('-')));
        if (eventsInWeek.length > 0) {
            const [day, month, year] = eventsInWeek[0].sd.split('/');
            targetDay = new Date(year, month - 1, day);
        }
        newOffset = Math.round((targetDay - today) / (1000 * 60 * 60 * 24));
    }
    currentDateOffset = Math.max(0, Math.min(newOffset, maxOffset));
    currentView = newView;
    localStorage.setItem('calendarView', newView);
    updateViewButtons();
    renderCalendar();
}

function handleTouchStart(evt) {
    const firstTouch = evt.touches[0];
    touchStartX = firstTouch.clientX;
    touchStartY = firstTouch.clientY;
}

function handleTouchMove(evt) {
    // This can be left empty, but is part of the touch event flow
}

function handleTouchEnd(evt) {
    const endTouch = evt.changedTouches[0];
    const touchEndX = endTouch.clientX;
    const touchEndY = endTouch.clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const swipeThreshold = 50; // Shorter distance for easier detection
    const swipeLeniency = 0.8; // Allows for more diagonal swipes
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * swipeLeniency;
    if (isHorizontalSwipe && Math.abs(deltaX) > swipeThreshold) {
        triggerSwipeFeedback(); // Give visual feedback for the swipe
        if (deltaX < 0) {
            if (!nextBtn.disabled) navigateNext();
        } else {
            if (!prevBtn.disabled) navigatePrevious();
        }
    }
}

// Now triggers a visual pulse on the day headers
function triggerSwipeFeedback() {
    const headers = document.querySelectorAll('.day-header');
    headers.forEach(header => {
        header.classList.add('swipe-feedback');
        // Remove the class after the animation finishes to allow it to be re-triggered
        header.addEventListener('animationend', () => {
            header.classList.remove('swipe-feedback');
        }, { once: true });
    });
}

function showInstructionPopup() {
    instructionOverlay.classList.remove('hidden');
}
function hideInstructionPopup() {
    instructionOverlay.classList.add('hidden');
}

function checkFirstVisit() {
    if (!localStorage.getItem('hasVisited')) {
        showInstructionPopup();
        localStorage.setItem('hasVisited', 'true');
    }
}

function updateViewButtons() {
    if (currentView === 'weekly') {
        weeklyViewBtn.classList.add('active');
        dailyViewBtn.classList.remove('active');
    } else {
        dailyViewBtn.classList.add('active');
        weeklyViewBtn.classList.remove('active');
    }
}

function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
}

function initializeSidebarState() {
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
}

function updateColorIndicators() {
    const indicatorContainer = document.getElementById('group-color-indicators');
    indicatorContainer.innerHTML = ''; 
    allUniqueGroups.forEach(group => {
        const indicator = document.createElement('div');
        const isActive = selectedGroups.includes(group);
        if (isActive) {
            indicator.className = 'color-indicator';
            const color = groupColors[group] || '#ccc';
            indicator.style.backgroundColor = color;
            indicator.style.setProperty('--glow-color', hexToRgba(color, 0.7));
        } else {
            indicator.className = 'color-indicator inactive';
        }
        indicatorContainer.appendChild(indicator);
    });
}

function setupCurrentTimeTimer() {
    updateCurrentTimeIndicator();
    if (currentTimeInterval) clearInterval(currentTimeInterval);
    currentTimeInterval = setInterval(updateCurrentTimeIndicator, 60000);
}

function updateCurrentTimeIndicator() {
    document.querySelectorAll('.current-time-line').forEach(line => line.remove());
    const now = new Date();
    const todayStr = dateToYyyyMmDdString(now);
    const todayColumnTimeline = document.querySelector(`.day-column[data-date='${todayStr}'] .timeline`);
    if (!todayColumnTimeline) return;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const timelineStartMinutes = START_HOUR * 60;
    const timelineEndMinutes = END_HOUR * 60;
    if (currentMinutes < timelineStartMinutes || currentMinutes > timelineEndMinutes) return;
    const topPosition = ((currentMinutes - timelineStartMinutes) / 60) * HOUR_HEIGHT;
    const timeLine = document.createElement('div');
    timeLine.className = 'current-time-line';
    timeLine.style.top = `${topPosition}px`;
    todayColumnTimeline.appendChild(timeLine);
}

function showPopup() {
    popupOverlay.classList.remove('hidden');
}

function hidePopup() {
    popupOverlay.classList.add('hidden');
}

function showEventDetail(event) {
    if (!event) return;
    eventDetailTitle.textContent = event.t;
    eventDetailTime.textContent = `${event.st} - ${event.et}`;
    eventDetailLocation.textContent = event.l || 'No location specified';
    eventDetailGroup.textContent = `Group: ${event.g}`;
    const color = groupColors[event.g] || '#888';
    eventDetailBox.style.borderTopColor = color;
    eventDetailGroup.style.color = color;
    eventDetailOverlay.classList.remove('hidden');
}

function hideEventDetail() {
    eventDetailOverlay.classList.add('hidden');
}

function checkDataFreshness() {
    if (!scrapeMetadata.ts) return;
    const scrapedDate = new Date(scrapeMetadata.ts);
    const now = new Date();
    const currentHour = now.getHours();
    const isDayTime = currentHour >= 6 && currentHour < 22;
    const threshold = isDayTime ? STALE_THRESHOLD_DAY_MIN : STALE_THRESHOLD_NIGHT_MIN;
    const diffMinutes = Math.round((now - scrapedDate) / (1000 * 60));
    if (diffMinutes > threshold) {
        lastUpdatedElement.classList.add('stale-data');
        collapsedSidebarInfo.classList.add('stale-data');
        showPopup();
    } else {
        lastUpdatedElement.classList.remove('stale-data');
        collapsedSidebarInfo.classList.remove('stale-data');
    }
}

async function fetchData(url) {
    const response = await fetch(`${url}?t=${new Date().getTime()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
}

function initializeGroups() {
    const groupList = document.getElementById('group-list');
    allUniqueGroups = [...new Set(allEvents.map(event => event.g))].sort();
    const savedGroups = JSON.parse(localStorage.getItem('selectedGroups'));
    const defaultSelection = ['M2'];
    selectedGroups = savedGroups || defaultSelection;
    if (!savedGroups) localStorage.setItem('selectedGroups', JSON.stringify(selectedGroups));
    allUniqueGroups.forEach(group => {
        groupColors[group] = GROUP_SPECIFIC_COLORS[group] || getRandomColor(group);
        const button = document.createElement('button');
        button.className = 'group-btn';
        button.textContent = group;
        button.dataset.group = group;
        button.style.backgroundColor = groupColors[group];
        if (!selectedGroups.includes(group)) {
            button.classList.add('inactive');
        }
        button.addEventListener('click', () => {
            button.classList.toggle('inactive');
            const groupName = button.dataset.group;
            if (button.classList.contains('inactive')) {
                selectedGroups = selectedGroups.filter(g => g !== groupName);
            } else {
                selectedGroups.push(groupName);
            }
            localStorage.setItem('selectedGroups', JSON.stringify(selectedGroups));
            updateColorIndicators();
            renderCalendar();
        });
        groupList.appendChild(button);
    });
    updateColorIndicators();
}

function renderCalendar() {
    calendarContainer.innerHTML = ''; 
    calendarContainer.classList.toggle('weekly-view', currentView === 'weekly');
    const daysToShow = currentView === 'weekly' ? 7 : 2;
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + currentDateOffset);
    let firstDayOfView = new Date(baseDate);
    if (currentView === 'weekly') {
        const dayOfWeek = firstDayOfView.getDay();
        const difference = firstDayOfView.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        firstDayOfView.setDate(difference);
    }
    for (let i = 0; i < daysToShow; i++) {
        const dayDate = new Date(firstDayOfView);
        dayDate.setDate(dayDate.getDate() + i);
        const dayStr = dateToYyyyMmDdString(dayDate);
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';
        dayColumn.dataset.date = dayStr;
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        updateHeaderForDay(dayHeader, dayDate);
        const timeline = document.createElement('div');
        timeline.className = 'timeline';
        createTimelineHours(timeline);
        dayColumn.appendChild(dayHeader);
        dayColumn.appendChild(timeline);
        calendarContainer.appendChild(dayColumn);
        const eventsForDay = allEvents.filter(event => {
            const eventDate = event.sd.split('/').reverse().join('-');
            return selectedGroups.includes(event.g) && eventDate === dayStr;
        });
        renderDayEvents(eventsForDay, timeline);
    }
    updateNavButtonState();
    updateCurrentTimeIndicator();
}

function createTimelineHours(timeline) {
    const timelineHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
    timeline.style.height = `${timelineHeight}px`;
    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
        const topPos = (hour - START_HOUR) * HOUR_HEIGHT;
        const line = document.createElement('div');
        line.className = 'hour-line';
        line.style.top = `${topPos}px`;
        timeline.appendChild(line);
        if (hour > START_HOUR && hour < END_HOUR) {
            const label = document.createElement('div');
            label.className = 'hour-label';
            label.textContent = `${hour}:00`;
            label.style.top = `${topPos}px`;
            timeline.appendChild(label);
        }
    }
}

function renderDayEvents(dayEvents, timelineElement) {
    if (!dayEvents.length) return;
    const events = dayEvents
        .map(event => {
            const startMinutes = timeToMinutes(event.st);
            const endMinutes = timeToMinutes(event.et);
            if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;
            return {
                ...event,
                startMinutes,
                endMinutes,
                top: ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT,
                height: ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.startMinutes - b.startMinutes);
    const collisionBlocks = [];
    if (events.length > 0) {
        let currentBlock = [events[0]];
        collisionBlocks.push(currentBlock);
        let maxEndTimeInBlock = events[0].endMinutes;
        for (let i = 1; i < events.length; i++) {
            const event = events[i];
            if (event.startMinutes >= maxEndTimeInBlock) {
                currentBlock = [event];
                collisionBlocks.push(currentBlock);
                maxEndTimeInBlock = event.endMinutes;
            } else {
                currentBlock.push(event);
                maxEndTimeInBlock = Math.max(maxEndTimeInBlock, event.endMinutes);
            }
        }
    }
    for (const block of collisionBlocks) {
        block.sort((a, b) => a.startMinutes - b.startMinutes);
        const columns = [];
        for (const event of block) {
            let placed = false;
            for (const col of columns) {
                if (event.startMinutes >= col[col.length - 1].endMinutes) {
                    col.push(event);
                    event.colIndex = columns.indexOf(col);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                columns.push([event]);
                event.colIndex = columns.length - 1;
            }
        }
        for (const event of block) {
            event.totalColumns = columns.length;
        }
    }
    for (const event of events) {
        const eventBlock = document.createElement('div');
        eventBlock.className = 'event-block';
        const width = 100 / event.totalColumns;
        eventBlock.style.width = `calc(${width}% - 5px)`;
        eventBlock.style.left = `${event.colIndex * width}%`;
        eventBlock.style.top = `${event.top}px`;
        eventBlock.style.height = `${Math.max(20, event.height - 2)}px`;
        const color = groupColors[event.g] || '#ccc';
        eventBlock.style.backgroundColor = hexToRgba(color, 0.5);
        eventBlock.style.borderColor = color;
        eventBlock.style.setProperty('--glow-color', hexToRgba(color, 0.7));
        const isMobileWeekly = currentView === 'weekly' && window.innerWidth < MOBILE_BREAKPOINT;
        if (isMobileWeekly) {
            const locationText = event.l || 'N/A';
            const verticalText = locationText.split('').join('<br>');
            eventBlock.innerHTML = `<p class="event-title">${verticalText}</p>`;
            eventBlock.style.fontSize = '10px';
            eventBlock.style.lineHeight = '1.1';
            eventBlock.style.textAlign = 'center';
            eventBlock.style.padding = '4px 2px';
        } else {
            eventBlock.innerHTML = `<p class="event-title">${event.t}</p><p>${event.st} - ${event.et}</p><p>${event.l}</p>`;
        }
        eventBlock.addEventListener('click', () => showEventDetail(event));
        timelineElement.appendChild(eventBlock);
    }
}

function updateHeaderForDay(headerEl, date) {
    const isMobileWeekly = currentView === 'weekly' && window.innerWidth < MOBILE_BREAKPOINT;
    const options = { 
        weekday: isMobileWeekly ? undefined : 'short', 
        month: isMobileWeekly ? 'numeric' : 'short', 
        day: 'numeric' 
    };
    headerEl.textContent = date.toLocaleDateString(undefined, options);
    const todayStr = dateToYyyyMmDdString(new Date());
    if (dateToYyyyMmDdString(date) === todayStr) {
        headerEl.classList.add('today-header');
    }
}

function navigateNext() {
    const increment = currentView === 'weekly' ? 7 : 2;
    currentDateOffset += increment;
    renderCalendar();
}

function navigatePrevious() {
    const increment = currentView === 'weekly' ? 7 : 2;
    currentDateOffset -= increment;
    renderCalendar();
}

function updateNavButtonState() {
    const maxOffset = (scrapeMetadata.w - 1) * 7;
    prevBtn.disabled = (currentDateOffset <= 0);
    nextBtn.disabled = (currentDateOffset >= maxOffset);
    const period = currentView === 'weekly' ? 'Week' : 'Days';
    prevBtn.title = `Previous ${period}`;
    nextBtn.title = `Next ${period}`;
}

function setupLastUpdatedTimer() {
    const update = () => {
        if (!scrapeMetadata.ts) return;
        const scrapedDate = new Date(scrapeMetadata.ts);
        const now = new Date();
        const diffMinutes = Math.round((now - scrapedDate) / (1000 * 60));
        let textContent = '';
        if (diffMinutes < 1) { textContent = 'Last update: just now'; }
        else if (diffMinutes < 60) { textContent = `Last update: ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`; }
        else { const diffHours = Math.floor(diffMinutes / 60); textContent = `Last update: ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`; }
        lastUpdatedElement.textContent = textContent;
        collapsedSidebarInfo.textContent = textContent;
        checkDataFreshness();
    };
    update();
    if (lastUpdatedInterval) clearInterval(lastUpdatedInterval);
    lastUpdatedInterval = setInterval(update, 60000);
}

function timeToMinutes(timeStr) {
    if (typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function getRandomColor(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - color.length) + color;
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}