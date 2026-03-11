# Mediterrenean Weekly Food Planner

A data-driven weekly meal planner built with React, TypeScript, and Vite. It is designed for quickly tailoring a nutrition plan to a specific client, adjusting meals and portions, and generating a practical shopping list from the current week.

## Highlights

- Weekly planner with 5-day or 7-day setups
- Editable breakfasts, snacks, lunch bowls, dinners, and treats
- Per-meal portion overrides with live macro totals
- Shopping list generation from the active plan
- Basic analytics for food variety and protein coverage
- Fast to customize because meal logic is stored in JSON data files

## Tech Stack

- React 19
- TypeScript
- Vite
- jsPDF for PDF export

## Run Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

Vite will print the local URL in the terminal, typically `http://localhost:5173`.

### 3. Build for production

```bash
npm run build
```

### 4. Preview the production build

```bash
npm run preview
```

## How To Tailor The Planner For A Specific User

This project is intentionally data-first. In most cases, tailoring the planner does not require changing application logic.

### 1. Update the ingredient library

Edit [src/data/ingredients.json](src/data/ingredients.json).

Use this file to:
- rename ingredients to match the client's language or food preferences
- update categories such as `protein`, `veg`, `fruit`, or `carb`
- adjust nutrition values per `100g` or per piece
- add new ingredients that can be reused across meals

### 2. Customize recipe-based meals

Edit:
- [src/data/recipes/breakfast.json](src/data/recipes/breakfast.json)
- [src/data/recipes/snacks.json](src/data/recipes/snacks.json)

Use these files to:
- add or remove breakfast options
- define snack options for pre-workout or treat slots
- change default ingredient portions inside each recipe

### 3. Customize build-your-own meals

Edit:
- [src/data/bowlComponents.json](src/data/bowlComponents.json)
- [src/data/dinnerComponents.json](src/data/dinnerComponents.json)

Use these files to tailor lunch and dinner builders:
- bases
- proteins
- vegetables
- sauces
- extras

This is the main place to adapt the planner to a user's preferred cuisine, calorie targets, ingredient availability, or dietary constraints.

### 4. Adjust default week structure and targets

Edit [src/state/planStore.ts](src/state/planStore.ts).

Use this file to change:
- the default number of days shown
- the day labels
- default calorie and protein targets

### 5. Update the UI style for your project or a client

Edit:
- [src/styles/globals.css](src/styles/globals.css)
- [src/App.tsx](src/App.tsx)
- [src/features/planner/WeeklyPlanner.tsx](src/features/planner/WeeklyPlanner.tsx)

Use these files to adjust layout, typography, spacing, and planner interactions.

## Recommended Tailoring Workflow

1. Define the client's target calories and protein.
2. Clean up `ingredients.json` so the food library is accurate.
3. Add or replace breakfast and snack recipes.
4. Update lunch and dinner component options.
5. Launch the app and fine-tune portions directly in the planner UI.
6. Review the shopping list and analytics tabs before sharing the plan.


## Screenshots and GIFs
TODO

Asset path:
- `docs/screenshots/`
- `docs/gifs/`

```md
## Screenshots and GIFs

### Planner Overview
![Planner overview](docs/screenshots/planner-overview.png)

### Shopping List Flow
![Shopping list](docs/screenshots/shopping-list.png)

### Planner Interaction Demo
![Planner demo](docs/gifs/planner-demo.gif)
```

## Project Structure

```text
src/
  data/         Static nutrition data, recipes, and component options
  domain/       Core types and calculation logic for macros and shopping output
  features/     Feature-level UI for planning, shopping, analytics, and builders
  state/        Default plan creation and local state helpers
  styles/       Global visual system and shared styling rules
  App.tsx       Main application shell and tab orchestration
```

Structure overview:
- `src/data` contains the content layer of the app. This is the primary customization surface when adapting the planner to a different user.
- `src/domain` holds the calculation logic and shared types that power nutrition totals and shopping-list generation.
- `src/features` groups the UI by workflow, keeping planner, shopping, analytics, and editing tools modular.
- `src/state` defines default week setup and state-related utilities used to initialize the planner.
- `src/styles` centralizes the visual language so branding and presentation can be updated without touching business logic.

## Portfolio Summary

Mediterrenean Weekly Food Planner is a small product-style frontend focused on practical nutrition planning. The project demonstrates data modeling, reusable meal composition, derived shopping-list generation, analytics summaries, and a UI that can be retargeted quickly for different users without needing a backend.
