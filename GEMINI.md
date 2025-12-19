# Gemini CLI Configuration

---
## Project Overview

**Project name:** Angara (working title)  
**Description:** A web based always online multiplayer resource management game where the player collects resources for the greater good. It features a scrollable map with a grid that hides resources which can be mined or harvested. It does not feature combat, instead it is based on working together but no without its challenges.

---

## Technical details

**Backend Framework:** Symfony 7.4; PHP 8.4 (I am a Symfony veteran, just get to the point.)  
**Frontend Framework:** Vue 3; TypeScript (I am new to it, help we explain to teach me.)  
**Database:** MySQL 8.4  
**OS**: Ubuntu
**Web server**: nginx

### Principes

- The project is supposed to become a single-page application (SPA).
- Doctrine migrations are not yet used. Changes can be made directly, just use `doctrine:schema:update --force`.
- There are currently no tests of any kind, and that stay that way for now.

---

## Repository Structure

### Backend:
This is just your typical Symfony project.

`config/`: Contains the typical YAML config for a Symfony project.  
`docker/`: All the Docker containers the project uses (`app` (PHP), `db` (MySQL) and `web` (nginx)).  
`public/`: Entry point for the application.  
`rust/`: Ignore, never use it.  
`spacetimedb_data/`: Ignore, never use it.  
`src/`: Contains the usual source code for a typical Symfony structure.  
`templates/`: Contains the usual Twig templates for a typical Symfony structure.  

### Frontend:
`html/src/Rendeder`: Contains a custom render engine based on Canvas 2D. It must remain game agnostic.
`html/src/Game`: Contains the main game code where not directly part of Vue.
`html/src/components/Rendering/RenderViewport.vue`: Is the entry point of the application where the Game class is initialized along with some crucial parameters.

---

## Instructions
- For the backend, strictly adhere to the SOLID principles. Use the Symfony features as much as possible. Always use methods that correspond to the projects Symfony version.
- There is a pattern laid out in `src/CliAccess` that should be used to call controller commands on CLI without invoking the web app for ease.
- Do not remove commented out lines when rewriting a piece of code.
- For PHP always use Allman style (opening braces on new line)
- For Typescript always use typical K&R style.