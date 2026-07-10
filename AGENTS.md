# Angara Agent Guide

## Project

Angara is a browser-based cooperative multiplayer resource-management game. Symfony 7.4 / PHP 8.4 serves a Vue 3 / TypeScript SPA and the plain-JavaScript Three.js body explorer. The database is MySQL 8.4; production uses nginx on Ubuntu.

## General principles

- Keep this file current when an architectural decision, workflow, or environment gotcha changes.
- Use transactions at the highest application boundary for database operations.
- Seed through fixtures. The project does not use Doctrine migrations yet.
- Follow SOLID and use Symfony 7.4 features and conventions.
- Use the `src/CliAccess` pattern when invoking controller behavior from CLI code.
- Do not remove commented-out code while rewriting code unless the task explicitly includes dead-code cleanup.
- PHP uses Allman braces. TypeScript uses normal K&R style.
- Do not run TypeScript style checks or builds after TypeScript changes.

## Repository map

- `assets/`: Vue/TypeScript frontend. `assets/src/Rendeder` is a game-agnostic Canvas 2D engine.
- `config/`, `src/`, `templates/`, `public/`: standard Symfony application areas.
- `templates/index/index.html.twig`: active `/` page and HUD/importmap host.
- `public/explorer/`: plain-JavaScript Three.js explorer served without a build step.
- `templates/Game/game.html.twig`: unused stub.

The authoritative explorer architecture and performance invariants live in `public/explorer/AGENTS.md`. Do not reintroduce the removed lon/lat topology, cap geometry, topology selector, or `physical.planet` naming.

## Explorer essentials

- `physical.body` and its recursive `companions` describe serializable solar-system/body input.
- `config/behaviour.js` is the single tuning surface for camera, input, rendering, materials, highlights, performance, and debug behavior.
- Hexsphere is the only topology. The surface has `10 * frequency^2 + 2` cells.
- Multiple stars, deterministic displaced bodies, per-body atmosphere, body rotation/orbits, selectable atmosphere cells, reversible resource transitions, and click-to-glide are required behavior.
- Highlight materials keep depth testing enabled with polygon offset.
- The resource camera stays edge-on to the cut plane with body radial as camera-up.

## Development workflow

Run backend commands through the app container:

```text
docker exec angara-app php /var/www/html/bin/console <cmd>
```

- Container app root: `/var/www/html`.
- The web container is exposed on host port `4100`.
- Host/container sync is reliable for edits to existing files and files under subdirectories. New repository-root files may require `docker cp`.
- Entity deletions may need to be repeated inside the container if stale metadata remains.
- Apply schema directly with `doctrine:schema:update --force`.
- Clean database rebuild: `doctrine:schema:drop --force --full-database`, then `doctrine:schema:create`.
- Prefer single-quoted SQL for PowerShell `dbal:run-sql`; double inner quotes. Backtick the MySQL table ``system``.
- Seed development with `make fixtures`; use `make database` for a complete reset.
- Fixture reload changes the world ID; query it by identifier instead of hard-coding it.
- Keep foreign-key columns first after the primary key, or in the first logical position.

## Testing

- Run the PHP suite with `make test`.
- On Windows without `make`: `docker exec angara-app php /var/www/html/bin/phpunit -c /var/www/html/phpunit.dist.xml`.
- Tests use a dedicated `<dbname>_test` database through Doctrine's test suffix.
- Tests live under `src/<Bundle>/tests/` with namespace `App\<Bundle>\Tests\`.
- Economy functional coverage is in `src/GameCoreBundle/tests/Functional/Economy/EconomyTickTest.php`.
- Add a dedicated fixture for each functional test dataset.
- Use bulk DBAL fixture inserts for scale datasets instead of hydrating thousands of entities.
- Do not add tests outside the existing tested areas unless explicitly requested.

## Economy tick invariants

- The `app:economy:tick` pipeline is ORM-free and set-based.
- `WorldEconomyReader.streamResourceRows()` streams one system at a time.
- Tick calculation is two-pass and bounded-memory: aggregate/write sinks, then re-stream/evolve/write back.
- `TickReport` retains bounded aggregates; body detail is collected only with `collectDetail: true`.
- Current state is overwritten in bounded `current_*` tables inside one `connection->transactional()`.
- `CelestialBody.owner` is nullable and maps to `Player.celestialBodies`.

## Code style

- Avoid getters when a public read-only/private-set property is available.
- Prefer readable arrow functions; make them `static` when possible and always specify return types in typed code.
- Format PHP arrows as `static fn (): ReturnType => ...`.
- Do not comment method names; comment only non-obvious invariants or decisions.
- Put blank lines around block statements when they are not the first or last statement in the enclosing block.
- Use trailing commas in multiline arrays and argument lists.
