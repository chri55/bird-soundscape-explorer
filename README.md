# [Tweetr - Bird Soundscape Explorer](https://tweetr-soundscape-explorer.netlify.app/)

![Tweetr main view](src/assets/tweetr-main.png)

This tool aims to be a fun way to explore areas where birds have been seen and trakced across the US and Canada.

Featuring data from eBird, Xeno-Canto, iNaturalist, Wikipedia, and the National Park System, users can drop a pin anywhere in the US, and get interesting data about birds in that area. Data available is mostly limited to eBird's system, hence why there is not much on other contintents for now.

The national parks markers are not required to use, and simply represent "hotspots" where users have tracked and sighted lots of different birds. Try clicking the national park closest to you, and see which birds have been sighted there.

Once loaded, up to eight birds will start to play their cries. They can be muted individually, to help identify specific cries. If more than 8 birds were available, then birds can be rotated out using the dice button, to introduce new species into the mix.

![Loading a park](src/assets/loading-a-park.gif)

The panel along the right side shows "notable" (more rare) and most common bird sightings, along with the date(s) they were sighted, and approximate location. Clicking a bird reveals more information, and links their page on Wikipedia and eBird's website. You can also listen to a call directly from Xeno-Canto if one is available.

![Details pane](src/assets/details-pane.gif)

In the settings pane, you can exclude birds from showing up in the recordings. This is limited to loaded birds, so searching for a certain type may not show up if it is not currently loaded by an API.
