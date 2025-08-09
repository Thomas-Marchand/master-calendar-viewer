document.addEventListener('DOMContentLoaded', main);

// --- CONFIGURATION ---
const GIST_RAW_URL = 'https://gist.githubusercontent.com/Thomas-Marchand/427d44e917d26d6073378d81db84d5b2/raw/calendar_events.json';
const START_HOUR = 6;
const HOUR_HEIGHT = 60; // 60px per hour
const GROUP_SPECIFIC_COLORS = {
    "M1": "#4243a6",
    "M2": "#eb0909",
    "M1_ANDROIDE": "#ba0c50",
    "M2_ANDROIDE": "#bf1e9a"
};
const STALE_THRESHOLD_DAY_MIN = 15;
const STALE_THRESHOLD_NIGHT_MIN = 70;

// --- Global State ---
let allEvents = [], groupColors = {}, selectedGroups = [], scrapeMetadata = {}, currentDateOffset = 0, lastUpdatedInterval, currentTimeInterval;
const popupOverlay = document.getElementById('popup-overlay');
const popupBox = document.getElementById('popup-box');
const popupCloseBtn = document.getElementById('popup-close-btn');
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');


async function main() {
    document.getElementById('prev-btn').addEventListener('click', navigatePrevious);
    document.getElementById('next-btn').addEventListener('click', navigateNext);
    sidebarToggleBtn.addEventListener('click', toggleSidebar);
    popupCloseBtn.addEventListener('click', hidePopup);
    popupOverlay.addEventListener('click', hidePopup);
    popupBox.addEventListener('click', (e) => e.stopPropagation());

    createTimelineHours();
    initializeSidebarState();

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

function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
}

function initializeSidebarState() {
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
}

function updateColorIndicators() {
    const indicatorContainer = document.getElementById('group-color-indicators');
    indicatorContainer.innerHTML = '';
    selectedGroups.forEach(group => {
        const indicator = document.createElement('div');
        indicator.className = 'color-indicator';
        const color = groupColors[group] || '#ccc';
        indicator.style.backgroundColor = color;
        indicator.style.setProperty('--glow-color', hexToRgba(color, 0.7));
        indicatorContainer.appendChild(indicator);
    });
}


function setupCurrentTimeTimer() {
    updateCurrentTimeIndicator();
    if (currentTimeInterval) clearInterval(currentTimeInterval); // Clear old timers
    currentTimeInterval = setInterval(updateCurrentTimeIndicator, 60000); // Update every minute
}

function updateCurrentTimeIndicator() {
    const existingLines = document.querySelectorAll('.current-time-line');
    existingLines.forEach(line => line.remove()); // prevent duplicates

    if (currentDateOffset !== 0) { // If not today, no indicator
        return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const timelineStartMinutes = START_HOUR * 60;
    const timelineEndMinutes = 22 * 60; // 10 PM

    if (currentMinutes < timelineStartMinutes || currentMinutes > timelineEndMinutes) { // if outside the range, no indicator
        return;
    }

    const topPosition = ((currentMinutes - timelineStartMinutes) / 60) * HOUR_HEIGHT;
    
    const timeLine = document.createElement('div');
    timeLine.className = 'current-time-line';
    timeLine.style.top = `${topPosition}px`;
    
    const todayTimeline = document.getElementById('day1-timeline');
    if(todayTimeline) {
        todayTimeline.appendChild(timeLine);
    }
}


function showPopup() {
    popupOverlay.classList.remove('hidden');
}

function hidePopup() {
    popupOverlay.classList.add('hidden');
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
    const response = await fetch(`${url}?t=${new Date().getTime()}`); // force fresh fetch
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
}

function initializeGroups() {
    const groupList = document.getElementById('group-list');
    const uniqueGroups = [...new Set(allEvents.map(event => event.g))].sort();
    
    const savedGroups = JSON.parse(localStorage.getItem('selectedGroups'));
    const defaultSelection = ['M2'];
    selectedGroups = savedGroups || defaultSelection;
    if (!savedGroups) localStorage.setItem('selectedGroups', JSON.stringify(selectedGroups));
    
    uniqueGroups.forEach(group => {
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
    updateColorIndicators(); // Initial call
}

function createTimelineHours() {
    const timelines = document.querySelectorAll('.timeline');
    timelines.forEach(timeline => {
        // Clear existing hour lines and labels before creating new ones
        timeline.innerHTML = '';
        for (let hour = START_HOUR; hour <= 22; hour++) {
            const topPos = (hour - START_HOUR) * HOUR_HEIGHT;
            const line = document.createElement('div');
            line.className = 'hour-line';
            line.style.top = `${topPos}px`;

            if (hour < 22) {
                const label = document.createElement('div');
                label.className = 'hour-label';
                label.textContent = `${hour}:00`;
                label.style.top = `${topPos}px`;
                timeline.appendChild(label);
            }
            timeline.appendChild(line);
        }
    });
}

function renderCalendar() {
    const day1Timeline = document.getElementById('day1-timeline');
    const day2Timeline = document.getElementById('day2-timeline');
    
    // Detach event blocks before clearing
    const eventBlocks1 = Array.from(day1Timeline.querySelectorAll('.event-block'));
    const eventBlocks2 = Array.from(day2Timeline.querySelectorAll('.event-block'));
    eventBlocks1.forEach(block => block.remove());
    eventBlocks2.forEach(block => block.remove());


    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + currentDateOffset);
    
    const day1Date = new Date(baseDate);
    const day2Date = new Date(baseDate);
    day2Date.setDate(day1Date.getDate() + 1);

    const day1Str = day1Date.toISOString().split('T')[0];
    const day2Str = day2Date.toISOString().split('T')[0];

    updateHeaders(day1Date, day2Date);

    const eventsToRender = allEvents.filter(event => {
        const eventDate = event.sd.split('/').reverse().join('-');
        return selectedGroups.includes(event.g) && (eventDate === day1Str || eventDate === day2Str);
    });
    
    // Re-create hours in case they were cleared
    // Note: createTimelineHours() is now more careful about clearing
    if (day1Timeline.children.length < 10) createTimelineHours();

    renderDayEvents(eventsToRender.filter(e => e.sd.split('/').reverse().join('-') === day1Str), day1Timeline);
    renderDayEvents(eventsToRender.filter(e => e.sd.split('/').reverse().join('-') === day2Str), day2Timeline);
    
    updateNavButtonState();
    updateCurrentTimeIndicator();
}

function renderDayEvents(dayEvents, timelineElement) {
    // Clear only event blocks from the timeline
    const existingEvents = timelineElement.querySelectorAll('.event-block');
    existingEvents.forEach(e => e.remove());

    dayEvents.sort((a, b) => a.st.localeCompare(b.start_time));
    const eventsWithLayout = [];
    for (const event of dayEvents) {
        const startMinutes = timeToMinutes(event.st);
        const endMinutes = timeToMinutes(event.et);
        if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) continue;
        const top = ((startMinutes - (START_HOUR * 60)) / 60) * HOUR_HEIGHT;
        const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
        eventsWithLayout.push({ ...event, top, height, overlaps: [], position: 0 });
    }
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
        const lightColor = lightenHexColor(color, 40);
        eventBlock.style.backgroundColor = hexToRgba(color, 0.5);
        eventBlock.style.borderColor = color;
        eventBlock.style.boxShadow = `0 0 0 1px ${lightColor}`;

        eventBlock.innerHTML = `<p class="event-title">${event.t}</p><p>${event.st} - ${event.et}</p><p>${event.l}</p>`;
        timelineElement.appendChild(eventBlock);
    }
}

function lightenHexColor(hex, amount) {
    let usePound = false;
    if (hex[0] === "#") { hex = hex.slice(1); usePound = true; }
    const num = parseInt(hex, 16);
    let r = (num >> 16) + amount;
    if (r > 255) r = 255;
    let b = ((num >> 8) & 0x00FF) + amount;
    if (b > 255) b = 255;
    let g = (num & 0x0000FF) + amount;
    if (g > 255) g = 255;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}


function updateHeaders(day1, day2) {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const day1Header = document.getElementById('day1-header');
    const day2Header = document.getElementById('day2-header');
    
    day1Header.textContent = day1.toLocaleDateString(undefined, options);
    day2Header.textContent = day2.toLocaleDateString(undefined, options);

    // Remove class from both first to reset
    day1Header.classList.remove('today-header');
    day2Header.classList.remove('today-header');

    if (currentDateOffset === 0) {
        day1Header.classList.add('today-header');
    }
}

function navigateNext() {
    const maxOffset = (scrapeMetadata.w - 1) * 7;
    if (currentDateOffset >= maxOffset) return;
    currentDateOffset += 2; renderCalendar();
}
function navigatePrevious() {
    if (currentDateOffset <= 0) return;
    currentDateOffset -= 2; renderCalendar();
}
function updateNavButtonState() {
    const maxOffset = (scrapeMetadata.w - 1) * 7;
    document.getElementById('prev-btn').disabled = (currentDateOffset <= 0);
    document.getElementById('next-btn').disabled = (currentDateOffset >= maxOffset);
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
    lastUpdatedInterval = setInterval(update, 60000); // update every minute
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