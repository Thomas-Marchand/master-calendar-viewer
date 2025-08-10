# Master Calendar Viewer

This project was created to provide students with a faster, more responsive, and mobile-friendly alternative to the official university web calendar. The original calendar, while functional, can be slow to load and difficult to navigate on a phone. This viewer solves that by pre-processing the public calendar data and displaying it in a clean, dark-mode interface.

The official calendar, which is the source of all data displayed here, can be found at: **[cal.ufr-info-p6.jussieu.fr](https://cal.ufr-info-p6.jussieu.fr/master/)**

> A quick demo showing the interface and group filtering.
>
> ![Demo GIF](calendar-demo.gif)

## ✨ Features

*   **Automated Scraping:** A script navigates the calendar and extracts event data for multiple groups.
*   **Mobile-First Dark Mode UI:** A clean, responsive interface designed for phone screens, with both daily and weekly views.
*   **Dynamic Group Filtering:** Users can toggle which groups they want to see, with their preferences automatically saved in their browser for future visits.
*   **Multi-Day Navigation:** Users can navigate through the calendar using buttons, keyboard arrow keys, or by swiping on a touch device.
*   **Data Freshness Alerts:** The interface monitors the age of the scraped data and visually alerts the user with a popup if it becomes stale, suggesting they check the original source.

## ⚡ Performance: Why a Decoupled Viewer?

By separating the slow data collection from the fast data presentation, this viewer significantly improves performance and **reduces the load on the university's servers**. Instead of every user loading the entire heavy calendar application, they download a lightweight static page that fetches only the pre-processed event data.

This results in:
*   **Faster Load Times:** Near-instantaneous loads versus several seconds for the original application.
*   **Reduced Data Transfer:** Megabytes of assets for the original page versus just kilobytes of JSON data for this viewer.
*   **Fewer Server Requests:** A single data request versus dozens of requests for scripts, styles, and images on the original site.

> The following chart illustrates the dramatic difference in initial page load resources between the original calendar and this viewer.
>
> ![Performance Comparison Chart](performance-comparison.png)

## ⚙️ How It Works

This project uses a decoupled architecture to separate data collection from data presentation.

### 1. The Scraper (local)
This is a script that runs locally to scrape only the necessary calendar data and upload it to a public Gist, which acts as a free, simple JSON API.
*   **Technology:** Python

### 2. The Frontend Viewer (`index.html`, `style.css`, `script.js`)

This is a completely static web application hosted for free on GitHub Pages. It has no backend server of its own.
*   **Technology:** HTML, CSS, Vanilla JavaScript.

## 🚀 Setup and Installation

No setup required! Just visit the page [here](https://thomas-marchand.github.io/master-calendar-viewer) to view the calendar.

## 📝 Feedback and Cooperation

This is an independent project created for the benefit of the student community.

*   **Feedback & Requests:** Have a feature request, found a bug, or have any other feedback? Please **[open an issue](https://github.com/username/master-calendar-viewer/issues)** on this repository. All feedback is welcome.
*   **Cooperation:** This project relies on publicly available data. If you are an official representative of the university and have any concerns, questions, or wish for this site to be taken down, please open an issue or contact me directly.

## 🗺️ Project Roadmap

### ✅ Achieved Goals
- [x] Core scraping logic.
- [x] Data persistence via API (GitHub Gist).
- [x] Clean, mobile-friendly dark mode user interface.
- [x] Daily and Weekly views.
- [x] Client-side preference storage for group filters.
- [x] Dynamic timeline view with intelligent overlap management.
- [x] Multi-day navigation (buttons, keyboard, swipe).
- [x] "Last updated" timestamp and stale data alerts.
- [x] Live "current time" indicator.

### 🚧 Future Goals (that I might never implement)
- [ ] **More groups:** Add more groups to the viewer.
- [ ] **Smart Day Fetching:** Instead of a fixed number of weeks, calculate how far ahead to scrape based on the last known event for each group.
- [ ] **Data Optimization:** Implement a check within the scraper to see if the calendar data has actually changed before making an API call to update the Gist, saving resources.
- [ ] **User-Selectable Themes:** Add a toggle for a light mode theme.
- [ ] **Search/Filter by Event Title:** Add an input field to filter the visible events by name.

## 📄 License
This project is open source and available under the [MIT License](LICENSE).