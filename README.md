WaterViz
========

By [Richard Barnes](http://rbarnes.org).<br>
See the [live map](http://waterviz.com) and [the source code](https://github.com/r-barnes/waterviz).

## Introduction

WaterViz aims to provide a high-level view of water availability and factors affecting its quantity and quality by providing a visual overview of real-time river conditions in the conterminous United States. Rivers and all active U.S. gauge stations are colored and sized based on how their current discharge rate ranks against a thirty year history. Optionally, current land use can be displayed, as well as an analysis of how land use has changed in proximity to water.



Hovering over rivers and stations

visualize the current discharge rate and stage height of rivers
in the conterminuous United States along with information to aid in
understanding the hydrography of the U.S. The project draws data from a variety
of sources to make this happen.

## Technology

### Server Side
1. [PostgreSQL](http://www.postgresql.org/) and
  [PostGIS](http://postgis.refractions.net/) for a geospatial database.
  PostgreSQL 9.1 or later and PostGIS 2 are recommended for ease of installing
  the PostGIS extension. This database is moderately large; you may want to
  [tune Postgres settings](http://nelsonslog.wordpress.com/2011/10/12/quick-post
  gresql-tuning-notes/) to use more memory.
2. [TileStache](http://tilestache.org/) for the Python web app that serves map
   tiles. TileStache has an undocumented dependency on
   [Shapely](https://pypi.python.org/pypi/Shapely) that you can install via
   `pip`.
3. [Gunicorn](http://gunicorn.org/): A Python web server container
4. [Flask](http://flask.pocoo.org/): A Python microframework web server
5. [Numpy](http://www.numpy.org/): Used for number crunching in determine county statistics
6. [Psycopg2](http://initd.org/psycopg/): A Python library for interfacing with PostGIS
7. [Nginx](http://nginx.org/en/): A light-weight, secure, fast web server through which we will proxy all the other servers to gain security and cacheing
8. [`pip`](http://www.pip-installer.org/en/latest/): Used to install the latest Python packages
9. [p7zip](http://p7zip.sourceforge.net/) for unpacking NHDPlus and NLCD data. Ubuntu users be sure to install `p7zip-full`.
10. shp2pgsql, part of PostGIS, for importing ESRI shapefiles into PostGIS
11. [pgdbf](https://github.com/kstrauser/pgdbf) for importing DBF databases into PostgreSQL. Note you need at least version 0.6.2 for the `-s` flag.
12. [requests](http://docs.python-requests.org/en/latest/): Used to retrieve real-time hydrographic data
13. [gdal](http://www.gdal.org/): For creating NLCD tiles and performing statistics on them

### Client side
1. [Leaflet](http://leafletjs.com/): A simple, blazin' fast map handlin' library
2. [D3.js](http://d3js.org/): Data-driven documents, allows quick loading of river networks
3. [Underscore.js](http://underscorejs.org/): A JS functional programming library
4. [jQuery](https://jquery.com/): A library for expediting JS DOM manipulations

## Data Sources
1. [NHDPlus](http://www.horizon-systems.com/nhdplus/): Source for river flowlines, gauge locations, gauge information, and gauge history
2. [NLCD 2011](http://www.mrlc.gov/nlcd2011.php): Source for the land use information
3. [Census TIGER/Line](http://www2.census.gov/geo/tiger/GENZ2013/cb_2013_us_county_5m.zip): Source for county outlines

## Getting started

This project contains everything you need from start to finish to make a vector
based web map of American rivers in the contiguous 48 states. There are three
parts to the project: data preparation, HTTP serving of vector tiles, and
clients that render maps.

## Quick start

* Install the aforementioned software.
* Run `dataprep/downloadNhd.sh` to download data to a directory named "NHD".
* Run `dataprep/importNhd.sh` to bring data NHD into a PostGIS database named "rivers".
* Run `serve.sh` from inside the `server` directory
to start TileStache in Gunicorn at [http://localhost:8000/](http://localhost:8000/).
* Load [a sample tile on localhost](http://localhost:8000/rivers/13/1316/3169.json)
to verify GeoJSON tiles are being served.
* Run `server/gauges.py` from within its directory to serve up information needed for styling rivers and counties
* Set up a cron job to run `server/gauges_backend.py` to keep new data flowing in
* Load `clients/index.html` to view the map.
* Use `server/nginx-rivers.conf` to configure the nginx server.

## About vector tiles

Vector tiles are an exciting, underutilized idea to make
efficient maps. Google Maps revolutioned online cartography with "slippy maps",
raster maps that are a mosaïcof PNG or JPG images. But a lot of geographic data is
intrinsically vector oriented, lines and polygons. Today many map servers
render vector data into raster images that are then served to clients.
But serving the vector data directly to the user's browser for rendering
on the client can make maps that are more flexible and more efficient.

In this project, we use vector tiles to serve up all of the rivers in the United
States. We are then able to style these rivers client-side based on recent
hydrographic data.

### Extra Ubuntu 14.04 details

A partial list of installation instructions:

```
# Install needed software with apt and PIP
apt-get install git p7zip-full python-pip postgresql-server-dev-all python-dev libevent-dev gdal-bin postgis postgresql-client postgresql pgdbf nginx
pip install psycopg2 gunicorn tilestache requests grequests shapely --allow-external PIL --allow-unverified PIL

# Postgres needs to be set up with appropriate user login.
sudo -u postgres createuser -s -d nelson

# Configure Postgres to let user connect without password by specifying "trust" method
# (or else alter code to supply a password)
edit /etc/postgresql/9.3/main/pg_hba.conf

# Optionally tune postgres performance
edit /etc/postgresql/9.3/main/postgresql.conf
```

## Project components

This project consists of several short scripts and configuration files to
glue together the software components. There is precious little programming
logic here, most of it is integration.

* `dataprep/downloadNhd.sh` downloads data from [NHDPlus](http://www.horizon-
systems.com/nhdplus/), a nice repository of cleaned up National Hydrographic
Data distributed as ESRI shapefiles. This shell script takes care of
downloading the files and then extracting the specific data files we're
interested in. NHDPlus is a fantastic resource if you're interested in mapping
water in the United States. Note by default the script only downloads data
for California; edit the script if you want the entire US.

* `dataprep/importNhd.sh` imports the NHDPlus data into PostGIS and
prepares it for serving. This script borrows ideas from [Seth Fitzsimmons'
NHD importer](https://gist.github.com/mojodna/b1f169b33db907f2b8dd). Note that
detailed output is logged to a file named `/tmp/nhd.log.*`, see the first line
of script output for details. The steps this script takes are:<ol><li>Create a database named `rivers`
<li>Import NHDFlowline shapefiles into a table named `nhdflowline`
<li>Import PlusFlowlineVAA DBF files into a table named `plusflowlinevaa`
<li>Run `processNhd.sql` to create a table named `rivers`
<li>Run `mergeRivers.py` to create a table named `merged_rivers`
</ol>

* `dataprep/processNhd.sql` prepares the imported data to a format more tailored
to our needs. It makes a new table named `rivers` which joins
the geometry from NHDFlowline with metadata such as river name,
[reach code](http://nhd.usgs.gov/nhd_faq.html#q119), and
[Strahler number](http://en.wikipedia.org/wiki/Strahler_number) from
PlusFlowlineVAA. It has about 2.7 million rows for the whole US. (NHDFlowline
has nearly 3 million rows; flowlines which have no comid in
PlusFlowlineVAA are discarded.)

* `dataprep/mergeRivers.py` optimizes the data by merging geometry. NHD data
has many tiny little rows for a single river. For efficiency
we merge geometries based on river ID and the
HUC8 portion of the reach code. The resulting `merged_rivers` table
has about 330,000 rows.
This step is complex and not strictly necessary &mdash;
TileStache can serve the geometry
in the `rivers` table directly. But the resulting GeoJSON is large and slow
to render;
merging each river into a single LineString or MultiLineString results in
vector tiles roughly one tenth the size and time to process.

* `server/serve.sh` is a simple shell script to invoke Gunicorn and the TileStache
webapp and serve it at [http://localhost:8000/](http://localhost:8000/).
In a real production deployment this should be replaced with a server
management framework. (It's also possible to serve TileStache via CGI, but
it's terribly slow.)

* `server/gunicorn.cfg.py` is the Gunicorn server configuration. There's very little
here in this example, Gunicorn has [many configuration
options](http://docs.gunicorn.org/en/latest/configure.html).

* `server/tilestache.cfg` sets up TileStache to serve a single layer named `rivers`
from the `merged_rivers` table, backed by a cache in `/tmp/stache`.
It uses the [VecTiles
provider](http://tilestache.org/doc/TileStache.Goodies.VecTiles.html), the
magic in TileStache that takes care of doing PostGIS queries and preparing
nicely cropped GeoJSON tiles. At this layer we start making significant
cartographic decisions.

## Cartographic decisions

Some cartographic decisions are made on the server side. The TileStache
VecTiles configuration contains an array of queries that return results at
different zoom levels. At high zoom levels (say z=4) we only return rivers
which are relatively big, those with a [Strahler
number](http://en.wikipedia.org/wiki/Strahler_number) of 6 or higher. At finer
grained zoom levels we return more and smaller rivers. This per-zoom filtering
both limits the bandwidth used on large scale maps and prevents the display
from being overcluttered. Rendering zillions of tiny streams can be
[quite beautiful](http://www.flickr.com/photos/nelsonminar/sets/72157633504361549/detail/),
but also resource intensive.

VecTiles also simplifies the geometry, serving only the precision needed at the
zoom level. You can see this in action if you watch it re-render as you
navigate; rivers will start to grow more bends and detail as you zoom in.
TileStache does that for us automatically.

## Credits

[Nelson Minar](http://www.somebits.com/) developed the original river
visualization and some/much of the writing above about that. I have added all
the real-time connections, colour and size styling, county buffer analysis, and
NLCD tiles.