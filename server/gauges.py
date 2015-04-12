#!/usr/bin/env python3
import os
from flask import Flask, jsonify, send_from_directory, abort, Response, request
import psycopg2
import psycopg2.extras
import json

app = Flask(__name__)

conn = psycopg2.connect("dbname='rivers' user='nelson' host='localhost' password='NONE'")

#@app.route('/')
#def index():
#  return send_from_directory('.', 'index.html')

@app.route('/gauges/list/<string:xmin>/<string:ymin>/<string:xmax>/<string:ymax>', methods=['GET'])
def show_gaugelist(xmin,ymin,xmax,ymax):
  cur = conn.cursor(cursor_factory = psycopg2.extras.RealDictCursor)


  cur.execute("""
SELECT site_code, lng, lat, to_char(sdt, 'YYYY-MM-DD HH24:MI') as sdt, svalue, to_char(sdt, 'YYYY-MM-DD HH24:MI') as ddt, dvalue, (SELECT percent_rank(dvalue) WITHIN GROUP (ORDER BY ave ASC) as drank
              FROM gage_smooth
              WHERE month=13 and year>=1985 and site_no=site_code
              GROUP BY site_no
          )
FROM (SELECT source_fea AS site_code, ST_X(geom) as lng, ST_Y(geom) as lat
        FROM   gageloc
        WHERE  geom
        @ -- contained by, gets fewer rows -- ONE YOU NEED!
        ST_MakeEnvelope (
          %(xmin)s, %(ymin)s, -- bounding
          %(xmax)s, %(ymax)s, -- box limits
          900913
        )
        ORDER BY random() LIMIT 500) AS c
NATURAL JOIN (SELECT a.site_code,a.dt as ddt, a.value as dvalue FROM gauge_data AS a JOIN (SELECT site_code, variable, max(dt) maxDate FROM gauge_data GROUP BY site_code,variable) b ON a.site_code = b.site_code AND a.variable='D' AND a.variable=b.variable AND a.dt = b.maxDate) AS d
NATURAL JOIN (SELECT a.site_code,a.dt as sdt, a.value as svalue FROM gauge_data AS a JOIN (SELECT site_code, variable, max(dt) maxDate FROM gauge_data GROUP BY site_code,variable) b ON a.site_code = b.site_code AND a.variable='S' AND a.variable=b.variable AND a.dt = b.maxDate) AS e
  """, {"xmin":xmin,"ymin":ymin,"xmax":xmax,"ymax":ymax})

  return json.dumps(cur.fetchall())

if __name__ == '__main__':
    app.run(debug=True)
