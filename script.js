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
    "M2_ANDROIDE": "#bf1e9a"
};
const STALE_THRESHOLD_DAY_MIN = 15;
const STALE_THRESHOLD_NIGHT_MIN = 70;
const MOBILE_BREAKPOINT = 768;

// --- Global State ---
let allEvents = [], groupColors = {}, selectedGroups = [], scrapeMetadata = {}, currentDateOffset = 0, lastUpdatedInterval, currentTimeInterval;
let allUniqueGroups = [];
let currentView = 'daily'; // 'daily' or 'weekly'

// --- DOM Elements ---
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const calendarContainer = document.querySelector('.calendar-container');
const dailyViewBtn = document.getElementById('daily-view-btn');
const weeklyViewBtn = document.getElementById('weekly-view-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
// Popups
const popupOverlay = document.getElementById('popup-overlay');
const popupBox = document.getElementById('popup-box');
const popupCloseBtn = document.getElementById('popup-close-btn');
const eventDetailOverlay = document.getElementById('event-detail-overlay');
const eventDetailBox = document.getElementById('event-detail-box');
const eventDetailCloseBtn = document.getElementById('event-detail-close-btn');
const eventDetailTitle = document.getElementById('event-detail-title');
const eventDetailGroup = document.getElementById('event-detail-group');
const eventDetailTime = document.getElementById('event-detail-time');
const eventDetailLocation = document.getElementById('event-detail-location');


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
    } catch (error) {
        document.getElementById('loading-indicator').innerText = 'Failed to load calendar data.';
        console.error('Failed to initialize calendar:', error);
    }
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
    currentView = newView;
    localStorage.setItem('calendarView', newView);
    currentDateOffset = 0; // Reset offset when switching views
    updateViewButtons();
    renderCalendar();
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
    const todayStr = now.toISOString().split('T')[0];
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
    const lastUpdatedElement = document.getElementById('last-updated');
    if (!scrapeMetadata.ts) return;
    const scrapedDate = new Date(scrapeMetadata.ts);
    const now = new Date();
    const currentHour = now.getHours();
    const isDayTime = currentHour >= 6 && currentHour < 22;
    const threshold = isDayTime ? STALE_THRESHOLD_DAY_MIN : STALE_THRESHOLD_NIGHT_MIN;
    const diffMinutes = Math.round((now - scrapedDate) / (1000 * 60));
    if (diffMinutes > threshold) {
        lastUpdatedElement.classList.add('stale-data');
        showPopup();
    } else {
        lastUpdatedElement.classList.remove('stale-data');
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
    calendarContainer.innerHTML = ''; // Clear previous view
    calendarContainer.classList.toggle('weekly-view', currentView === 'weekly');

    const daysToShow = currentView === 'weekly' ? 7 : 2;
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + currentDateOffset);

    let firstDayOfView = new Date(baseDate);
    if (currentView === 'weekly') {
        const dayOfWeek = firstDayOfView.getDay();
        const difference = firstDayOfView.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday as first day
        firstDayOfView.setDate(difference);
    }

    for (let i = 0; i < daysToShow; i++) {
        const dayDate = new Date(firstDayOfView);
        dayDate.setDate(dayDate.getDate() + i);
        const dayStr = dayDate.toISOString().split('T')[0];

        // Create column elements
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
        
        // Render events for this day
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
    dayEvents.sort((a, b) => a.st.localeCompare(b.st));
    const eventsWithLayout = [];
    for (const event of dayEvents) {
        const startMinutes = timeToMinutes(event.st);
        const endMinutes = timeToMinutes(event.et);
        if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) continue;
        const top = ((startMinutes - (START_HOUR * 60)) / 60) * HOUR_HEIGHT;
        const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
        eventsWithLayout.push({ ...event, top, height, overlaps: [], position: 0 });
    }
    // Very basic overlap detection and positioning
    for (let i = 0; i < eventsWithLayout.length; i++) {
        for (let j = i + 1; j < eventsWithLayout.length; j++) {
            const eventA = eventsWithLayout[i]; const eventB = eventsWithLayout[j];
            if (eventA.top < eventB.top + eventB.height && eventA.top + eventA.height > eventB.top) {
                eventA.overlaps.push(j); eventB.overlaps.push(i);
            }
        }
    }
    const processed = new Set();
    for (let i = 0; i < eventsWithLayout.length; i++) {
        if (processed.has(i)) continue;
        const group = [i, ...eventsWithLayout[i].overlaps];
        const takenPositions = new Set();
        group.forEach(idx => { if (eventsWithLayout[idx].position !== 0) takenPositions.add(eventsWithLayout[idx].position); });
        group.forEach(idx => { if (eventsWithLayout[idx].position === 0) { let pos = 0; while (takenPositions.has(pos)) pos++; eventsWithLayout[idx].position = pos; takenPositions.add(pos); } });
        group.forEach(idx => processed.add(idx));
    }

    for (const event of eventsWithLayout) {
        const eventBlock = document.createElement('div');
        eventBlock.className = 'event-block';
        const totalColumns = new Set(event.overlaps.map(i=>eventsWithLayout[i].position)).size + 1;
        eventBlock.style.width = `calc(${100 / totalColumns}% - 5px)`;
        eventBlock.style.left = `${(event.position * 100) / totalColumns}%`;
        eventBlock.style.top = `${event.top}px`;
        eventBlock.style.height = `${Math.max(20, event.height - 2)}px`;
        
        const color = groupColors[event.g] || '#ccc';
        eventBlock.style.backgroundColor = hexToRgba(color, 0.5);
        eventBlock.style.borderColor = color;
        eventBlock.style.setProperty('--glow-color', hexToRgba(color, 0.7));

        const isMobileWeekly = currentView === 'weekly' && window.innerWidth < MOBILE_BREAKPOINT;
        if (isMobileWeekly) {
            eventBlock.innerHTML = `<p class="event-title">${event.l || 'N/A'}</p>`;
            eventBlock.style.fontSize = '10px';
            eventBlock.style.display = 'flex';
            eventBlock.style.alignItems = 'center';
            eventBlock.style.justifyContent = 'center';
            eventBlock.style.textAlign = 'center';
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

    const todayStr = new Date().toISOString().split('T')[0];
    if (date.toISOString().split('T')[0] === todayStr) {
        headerEl.classList.add('today-header');
    }
}

function navigateNext() {
    const increment = currentView === 'weekly' ? 7 : 2;
    const maxOffset = (scrapeMetadata.w - 1) * 7;
    if (currentDateOffset >= maxOffset) return;
    currentDateOffset += increment;
    renderCalendar();
}

function navigatePrevious() {
    const increment = currentView === 'weekly' ? 7 : 2;
    if (currentDateOffset <= 0) return;
    currentDateOffset -= increment;
    if (currentDateOffset < 0) currentDateOffset = 0;
    renderCalendar();
}

function updateNavButtonState() {
    const maxOffset = (scrapeMetadata.w - 1) * 7;
    prevBtn.disabled = (currentDateOffset <= 0);
    nextBtn.disabled = (currentDateOffset >= maxOffset);

    const period = currentView === 'weekly' ? 'week' : 'days';
    prevBtn.title = `Previous ${period}`;
    nextBtn.title = `Next ${period}`;
}

function setupLastUpdatedTimer() {
    const lastUpdatedElement = document.getElementById('last-updated');
    const update = () => {
        if (!scrapeMetadata.ts) return;
        const scrapedDate = new Date(scrapeMetadata.ts);
        const now = new Date();
        const diffMinutes = Math.round((now - scrapedDate) / (1000 * 60));
        
        if (diffMinutes < 1) { lastUpdatedElement.textContent = 'Last update: just now'; }
        else if (diffMinutes < 60) { lastUpdatedElement.textContent = `Last update: ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`; }
        else { const diffHours = Math.floor(diffMinutes / 60); lastUpdatedElement.textContent = `Last update: ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`; }
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