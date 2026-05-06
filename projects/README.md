# Projects

Use this folder as the local project registry for work managed through Codex Hub Workspace.

Each real project can live in its own folder:

```text
projects/
+-- client-site/
+-- internal-tool/
`-- research-lab/
```

Recommended flow:

1. Create a folder under `projects/<project-name>/`.
2. Add or clone the project source there.
3. Register it in `projects/registry.md`.
4. Create task notes in `workspace/tasks/` when work becomes non-trivial.
5. Keep each project repo responsible for its own commits and remotes.

The public workspace keeps this folder as a skeleton. Project source folders are ignored by default so personal or client work is not accidentally committed to the workspace repo.

