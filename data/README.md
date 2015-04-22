Hurricane data was taken from the [IBTrACS-WMO
site](https://www.ncdc.noaa.gov/ibtracs/index.php?name=wmo-data). The CSV file
has been modified for reading into PostgreSQL using:

  DROP TABLE IF EXISTS hurricane;
  CREATE TABLE hurricane (
    stormid        CHAR(13),
    season         SMALLINT,
    Num            SMALLINT,
    Basin          CHAR(3),
    Sub_basin      CHAR(3),
    Name           VARCHAR(100),
    ISO_time       TIMESTAMP,
    Nature         CHAR(3),
    Latitude       REAL,
    Longitude      REAL,
    Wind           REAL,
    Pres           REAL,
    Center         VARCHAR(20),
    WindPercentile REAL,
    PresPercentile REAL,
    Track_type     CHAR(5)
  );

  create index hurricane_id on hurricane(stormid);
  create index hurricane_time on hurricane(iso_time);

The following code is for importing data to the table.

  \COPY hurricane FROM 'Allstorms.ibtracs_wmo.v03r06.csv' WITH DELIMITER ',' CSV HEADER