# Private BAfK atlas in PushNav

PushNav can import a private, locally prepared copy of the **Beobachter-Atlas für Kurzentschlossene (BAfK), July 2020**. The atlas PDF, prose, illustrations and index are **not** bundled with PushNav or committed to GitHub.

## Import on the PushNav laptop

1. Obtain the BAfK July 2020 PDF yourself.
2. Prepare the private package once (requires PyMuPDF for this one-time conversion):

   ```bash
   uv run --with pymupdf python scripts/build_bafk_package.py /path/to/BAfK_final_2020_07.pdf /path/to/bafk.zip
   ```

3. Start PushNav, open **What to See → Suche → BAfK-Atlas importieren**, and choose the generated ZIP file under **BAfK-Paket importieren**. Import is restricted to the computer running PushNav.
4. Search by catalog identifier or a word in the German observing descriptions. Selecting a result shows the image, observing notes, aperture and filter recommendations, original PDF page, and the ordinary PushNav target action.

The converter expects the **July 2020, 107-page edition**. It checks for 1,420 objects plus 23 associations and extracts 829 placed illustrations. It does not use OCR. The backend also validates the package count, file names, types, coordinates and archive sizes before replacing an existing local import.

Some objects have **no image**. Composite observations share illustrations and descriptions. The image credit and whether the illustration is a drawing or photograph must be checked in the original PDF. Astrophotographs do not necessarily represent the visual eyepiece appearance for a given telescope aperture.

## Where the private files go

After import, the data is stored under the user's existing PushNav/ElectronicViewfinder configuration directory in a `bafk/` subdirectory, alongside but separate from application settings. A new import replaces the previous one.

The laptop's local webserver makes the catalog, images and source PDF available to other PushNav clients on the same private network, including the phone view. This endpoint does **not** have user authentication; anyone able to access the PushNav webserver on that local network can see these imported materials. Do not expose the PushNav HTTP port to the public internet or untrusted networks.

The BAfK is a deep-sky observing guide, **not** a planetary ephemeris. Planet and Moon navigation remains a separate feature.
