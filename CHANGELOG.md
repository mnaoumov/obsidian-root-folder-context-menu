# CHANGELOG

## 1.4.53

- test(android): merge retrying the folder control press that Obsidian Mobile reads as a drag
- build(deps): move to obsidian-lib 6 and obsidian-dev-toolkit 5
- docs: shorten the debugging section
- chore: replace leftover obsidian-dev-utils references with @mnaoumov/obsidian-lib
- docs(readme): lead the Debugging section with `Advanced Debug Mode`
- build(deps): float brace-expansion, sharp and fast-uri past their advisories
- docs: mark plugin names as code
- docs(demo-vault): run the root folder Try it from a button
- chore(github): point questions to Discussions from the new-issue page
- ci: merge attesting release assets through the toolkit's reusable workflow

## 1.4.52

- build(deps): merge moving off obsidian-dev-utils onto the @mnaoumov packages
- docs: merge marking plugin names as code in markdown and comments
- test: merge using the obsidian-typings declarations of Obsidian internals

## 1.4.51

- test(screenshots): merge the move onto applyObsidianTheme
- build(deps): merge the obsidian-integration-testing 17 float
- chore(deps): merge the obsidian-test-mocks 7 float
- fix(test): merge the headless demo-vault toolkit install
- fix(deps): restore the lockfile's missing resolved and integrity fields
- fix(deps): float devalue to 5.9.4, clearing GHSA-9rgm-9g3h-6x36
- build(markdownlint): forbid hard-wrapped markdown paragraphs
- chore(deps): drop the two dead dedupe overrides
- chore(deps): drop the dead markdown-it override
- chore(deps): drop the dead js-yaml override
- style(comments): stop capitalizing the middle of a wrapped comment
- docs: drop the rule-id citations from the pin table
- docs: name the library and the sibling plugins so a reader can resolve them
- docs: replace the private tracker references with what they pointed at
- chore(deps): move to obsidian-dev-utils 103
- refactor(android): drive the context menu and its dismissal with trusted input
- chore: adopt the npm run gate branch gate
- docs: say where the debug command is run
- test: bring the in-closure wait ceiling under the transport's per-eval cap
- docs: name the unversioned demo-vault asset and the folder it unzips into
- chore: make the LICENSE copyright line checkable by the linter and guard it against the year roll-over
- fix(deps): move to obsidian-integration-testing 12 and obsidian-dev-utils 101
- fix(build): wire build:compile to buildCompile and drop the duplicate leaf script

## 1.4.50

- chore(deps): sweep caret-ranged dependencies to latest
- fix(deps): move to obsidian-integration-testing 11 and obsidian-dev-utils 96.5.2
- fix(deps): drop the brace-expansion file: override that breaks a clean install
- docs: point plugin-directory links at community.obsidian.md

## 1.4.49

- test(root-folder-context-menu): right-click and dismiss with trusted input on desktop

## 1.4.48

- docs(readme): render the same in Obsidian's plugin page as on GitHub
- chore: update libs
- chore: update obsidian-dev-utils to 94.6.1
- chore: update obsidian-dev-utils to 94.6.0
- fix: override deepmerge-ts to clear GHSA-ggr8-5vv4-36mx
- test: gate the demo vault by clicking every code button
- test: gate the demo vault by clicking every code button
- chore: teach cspell the advisory wording
- chore: update libs
- docs: capture the mobile screenshot set for root-folder-context-menu
- test: prove the root context menu on a real phone and desktop
- docs(demo-vault): give the demo vault its code buttons
- fix: make the root context menu reach mobile
- docs: capture the community-store screenshot set

## 1.4.47

- docs: make the demo vault the documentation, in the standard layout
- docs(demo-vault): bring the vault on-convention and register the coverage suite

## 1.4.46

- chore: update libs and adopt obsidian-integration-testing 10

## 1.4.45

- chore: update libs
- chore: update libs
- chore(vitest): adopt the shared Obsidian plugin vitest configuration
- chore: update libs and clear the npm audit
- docs: fix the demo vault download instructions

## 1.4.44

- chore: update libs
- chore: update libs

## 1.4.43

- chore: update libs

## 1.4.42

- chore: update libs
- chore(demo-vault): drop committed Invocables placeholder
- fix(demo-vault): export invoke() from startup script; add Invocables folder

## 1.4.41

- docs: standardize demo-vault README
- docs: drop per-plugin demo-vault setup notes (bootstrap covered by the obsidian-dev-utils harness)
- docs(demo-vault): create the `Root Folder Context Menu` demo vault
- chore: update libs
- docs: update
- docs: migrate to AGENTS.md

## 1.4.40

- chore: update libs
- chore: update obsidian-dev-utils to 85.0.0
- build: lock typescript to 6.0.3
- test: wire integration-testing vitest-setup into integration projects
- chore: update libs
- chore: sort tsconfig types

## 1.4.39

- refactor: new template

## 1.4.38

- refactor: new template

## 1.4.37

- chore: update libs

## 1.4.36

- chore: update template

## 1.4.35

- chore: update template

## 1.4.34

- chore: update libs

## 1.4.33

- chore: update libs

## 1.4.32

- chore: update libs

## 1.4.31

- chore: update libs
- chore: lint
- chore: enable markdownlint

## 1.4.30

- fix: build
- chore: update libs

## 1.4.29

- chore: enable conventional commits

## 1.4.28

- Minor changes

## 1.4.27

- Minor changes

## 1.4.26

- Minor changes

## 1.4.25

- Minor changes

## 1.4.24

- Minor changes

## 1.4.23

- Minor changes

## 1.4.22

- Minor changes

## 1.4.21

- Minor changes

## 1.4.20

- Minor changes

## 1.4.19

- Minor changes

## 1.4.18

- Check type of each item in menu.items (#4). Thanks to @kotaindah55

## 1.4.17

- Minor changes

## 1.4.16

- Minor changes

## 1.4.15

- Minor changes

## 1.4.14

- Minor changes

## 1.4.13

- Minor changes

## 1.4.12

- Minor changes

## 1.4.11

- Minor changes

## 1.4.10

- New template

## 1.4.9

- Minor changes

## 1.4.8

- Update templates

## 1.4.7

- Fix binding

## 1.4.6

- Lint

## 1.4.5

- Format

## 1.4.4

- Minor changes

## 1.4.3

- Replace console.log

## 1.4.2

- Minor changes

## 1.4.1

- Minor changes

## 1.4.0

- Hide inapplicable menu items
- Hide built-in menu

## 1.3.4

- Minor changes

## 1.3.3

- Avoid default exports

## 1.3.2

- Minor changes

## 1.3.1

- Minor changes

## 1.3.0

- Add empty files pane context menu
- Fix build

## 1.2.5

- Switch to new template

## 1.2.4

- Disable plugin with notifications

## 1.2.3

- Use strongly typed plugin name

## 1.2.2

- Restore override
- Use node types and namespaces

## 1.2.1

- Avoid unnecessary casting

## 1.2.0

- Ensure proper instance of the view is used
- Close legacy context menu

## 1.1.0

- Minor changes

## 1.0.3

- Minor changes

## 1.0.2

- Init plugin only when workspace is loaded

## 1.0.1

- Fix context menu for files

## 1.0.0

- Initial version
