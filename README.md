# Night Sky Memory Arcade

A static GitHub Pages website for memorising constellations, named stars, Messier objects, Caldwell objects, and relative positions on the celestial sphere.

## Games included

- Chart Quiz: guess the constellation from an IAU chart where only constellation names are blanked.
- Neighbour Web: learn which constellations sit near one another on IAU chart pages.
- Star Names: drill prominent named stars and their constellations/designations.
- DSOs: Messier and Caldwell catalogue drills for number, common name, object type, and constellation.
- 88 Timer: name all 88 IAU constellations against a timer.
- Abbrev Sprint: practise IAU abbreviations such as CMa, CVn, UMa, PsA, and CrA.
- Atlas: browse every chart and reveal the labelled version only after attempting recall.
- Tables: searchable data tables for self-study.

## Deploy on GitHub Pages

1. Download and unzip this folder.
2. Create a new GitHub repository.
3. Upload all extracted files and folders to the repository root.
4. Commit the upload.
5. Open Settings -> Pages.
6. Under Build and deployment, choose Deploy from a branch.
7. Select main and /(root), then Save.

If the repository is named `YOUR-USERNAME.github.io`, it will be served at `https://YOUR-USERNAME.github.io/`. Otherwise it will be served at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## Edit the data

All quiz data is in the `data/` folder. You can add more star names, aliases, or DSO notes without changing the game code.

## Notes

- The chart images keep star names, Greek letters, DSO numbers, and coordinate labels visible. Only constellation names are blanked.
- Serpens has two chart pages, Caput and Cauda, but it is one of the 88 official constellations.
- The datasets are intended for memorisation practice, not precision astrometry.
