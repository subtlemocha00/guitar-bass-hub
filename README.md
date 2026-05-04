# Practice Hub (Guitar & Bass)

A lightweight, static React application for organizing and practicing guitar and bass material. The app is designed for personal use, with a focus on simplicity, speed, and modular growth over time.

---

## Overview

Practice Hub is a centralized workspace for managing songs, tabs, and practice resources. It allows you to:

* Track which songs you are learning, planning, or have completed
* Access tabs and play-along videos in one place
* Organize practice material by instrument (bass, guitar, etc.)
* Extend functionality over time (tuner, exercises, theory, etc.)

The application is fully static and hosted via GitHub Pages, with no backend required initially. User-specific data is stored locally in the browser, with a planned path to cloud persistence later.

---

## Core Features (MVP)

### Instrument-Based Navigation

* Dedicated sections for:

  + Bass
  + Guitar
* Each section is independently scalable and built from shared components

---

### Song Management System

Each instrument page includes a structured list of songs with:

* Song title and artist
* Link to external tab resource
* Embedded YouTube player for play-along
* Status tracking:

  + Planned
  + Learning
  + Completed

Songs are grouped visually by status for quick navigation.

---

### Persistent Progress Tracking

* Song status is stored in `localStorage`
* Data persists between sessions on the same device
* No login or backend required

---

### Embedded Media

* YouTube videos are embedded directly into the app
* Enables practice without leaving the site

---

### Tuner (Planned in Early Phase)

* Built using the Web Audio API
* Provides real-time pitch detection via microphone input
* Implemented as an isolated feature module

---

## Technical Architecture

### Stack

* React (via Vite)
* Plain CSS (no UI frameworks)
* GitHub Pages (static hosting)

---

### Project Structure

```
/src
  /components     # Reusable UI components (SongCard, etc.)
  /pages          # Route-level pages (Bass, Guitar)
  /features
    /songs        # Song logic, hooks, storage abstraction
    /tuner        # Pitch detection feature
  /data           # Static song definitions (bassSongs.js, etc.)
  /hooks          # Shared hooks
  /utils          # Utility functions
```

---

### Data Design

#### Static Content (in repo)

Song metadata is defined in static files:

```js
{
    id: "muse-hysteria",
    title: "Hysteria",
    artist: "Muse",
    tabUrl: "...",
    youtubeId: "..."
}
```

This data is version-controlled and does not change per user.

---

#### User State (local)

User-specific data is stored separately:

* Song status (planned / learning / completed)
* Future: notes, tags, difficulty overrides

Stored using browser `localStorage` .

---

### Storage Abstraction

All persistence logic is handled through a storage layer (via hooks), allowing for a future transition to a backend without modifying UI components.

Current:

* `localStorage` implementation

Future:

* Cloud-based persistence (e.g., Firebase)

---

## Design Principles

* **Modular**: Features are isolated and composable
* **Data-driven**: UI is generated from structured data files
* **Minimal dependencies**: Avoid unnecessary libraries
* **Extensible**: New features can be added without restructuring the app
* **Fast iteration**: Optimized for personal use and quick updates

---

## Planned Enhancements

* Cross-device persistence (cloud storage)
* Song notes and annotations
* Tagging and filtering system
* Search functionality
* Additional practice tools:

  + Scales
  + Exercises
  + Backing tracks
* Improved tuner accuracy and UI

---

## Deployment

The app is built and deployed as a static site using GitHub Pages.

---

## Intended Use

This project is built as a personal practice tool for guitar and bass, with a focus on:

* Reducing friction during practice sessions
* Keeping all relevant resources in one place
* Tracking progress over time

---

## Status

Early-stage development. Core functionality (song tracking and playback) is the current priority.
