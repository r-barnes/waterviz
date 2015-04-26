#!/usr/bin/env python3
import os
from flask import Flask, jsonify, send_from_directory, abort, Response, request, g
import psycopg2
import psycopg2.extras
import json
import pickle
import numpy as np
import re

app = Flask(__name__)

aggregated_stats_file = 'county_agg_stats.p'
aggdata               = pickle.load(open(aggregated_stats_file, "rb"))

@app.before_request
def before_request():
  g.db = psycopg2.connect("dbname='rivers' user='nelson' host='localhost' password='NONE'")

@app.teardown_request
def teardown_request(exception):
  db = getattr(g, 'db', None)
  if db is not None:
      db.close()

#@app.route('/')
#def index():
#  return send_from_directory('.', 'index.html')

@app.route('/gauges/reachflow/<string:date>', methods=['GET'])
def show_reachflow(date):
  cur = g.db.cursor(cursor_factory = psycopg2.extras.RealDictCursor)
  cur.execute("SELECT * FROM reach_summary WHERE jday=%(date)s::date-'1970-01-01'::date", {"date":date})
  return json.dumps({"reachflows":cur.fetchall()})

@app.route('/gauges/getvals/<string:date>', methods=['POST'])
def show_gaugelist(date):
  cur         = g.db.cursor(cursor_factory = psycopg2.extras.RealDictCursor)
  gaugelist   = JSON.parse(request.form['gauages'])
  non_decimal = re.compile(r'[^\d]+')
  gaugelist   = filter(lambda x: non_decimal.match(x), gaugelist)
  gaugelist   = map(lambda x: "'"+x+"'", gaugelist)
  gaugelist   = ','.join(gaugelist)
  print gaugelist
  cur.execute("SELECT * FROM gauge_summary WHERE site_code IN ("+gaugelist+") AND jday=%(date)s::date-'1970-01-01'::date")
  return json.dumps({"gaugevals":cur.fetchall()})

@app.route('/gauges/list/<string:xmin>/<string:ymin>/<string:xmax>/<string:ymax>', methods=['GET'])
def show_gaugelist(xmin,ymin,xmax,ymax):
  cur = g.db.cursor(cursor_factory = psycopg2.extras.RealDictCursor)


  cur.execute("""
SELECT site_code,
      lng,
      lat,
      to_char(sdt, 'YYYY-MM-DD HH24:MI') as sdt,
      svalue,
      to_char(sdt, 'YYYY-MM-DD HH24:MI') as ddt,
      dvalue,
      featuredet,
      (SELECT percent_rank(dvalue) WITHIN GROUP (ORDER BY ave ASC) as drank
         FROM gage_smooth
         WHERE month=13 and year>=1985 and site_no=site_code
         GROUP BY site_no
      ),
      (SELECT station_nm FROM gageinfo WHERE gageid=site_code LIMIT 1) as name
FROM (SELECT source_fea AS site_code, ST_X(geom) as lng, ST_Y(geom) as lat, featuredet
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

@app.route('/hurricanes/<string:date>')
def show_hurricanes(date):
  cur = g.db.cursor(cursor_factory = psycopg2.extras.RealDictCursor)
  cur.execute("""SELECT stormid, max(name) as name, to_char(DATE(iso_time), 'YYYY-MM-DD') as dt, avg(latitude) as lat, avg(longitude) as lon, max(wind) as wind, max(pres) as pres, max(windpercentile) as windp, max(prespercentile) as presp from hurricane  where track_type='main' and stormid in (select distinct stormid from hurricane where iso_time=%(time)s) GROUP BY stormid,DATE(iso_time),track_type ORDER BY stormid,dt;""", {"time":date})
  temp = cur.fetchall()
  print(temp)
  return json.dumps({"hurricanes":temp})

@app.route('/county/style/<string:water_code>')
def get_mapstyle(water_code):
  if water_code not in aggdata:
    abort(404)

  print(request.args)
  percentile_max = request.args.get('percentile_max', 98);
  percentile_max = int(percentile_max)
  print(percentile_max);

  cdgood = [v['changedata'][0] if v['changedata'] else 0 for county, v in aggdata[water_code].items()]
  deving = np.array(list(filter(lambda x: x >= 0, cdgood)))
  nating = -np.array(list(filter(lambda x: x<0, cdgood)))

  devmax = np.percentile(deving,percentile_max)
  if len(nating)>0:
    natmax = np.percentile(nating,percentile_max)

  outdict = {}
  for county,v in aggdata[water_code].items():
    if not v['changedata']:
      continue
    val = v['changedata'][0]
    if val>=0:
      val   = val/devmax
      color = 'red'
    elif val<0:
      val   = abs(val)/natmax
      color = 'green'
    val = min(val,1)
    outdict[county] = {"fillColor":color,"fillOpacity":val}

  return jsonify(outdict)

@app.route('/county/<string:water_code>/<string:county>', methods=['GET'])
def get_county_data(water_code,county):
  print(water_code,county)
  if water_code not in aggdata or county not in aggdata[water_code]:
    abort(404)

  return jsonify(aggdata[water_code][county])

@app.route('/county/list', methods=['GET'])
def get_counties():
  allkeys = [list(v.keys()) for x,v in aggdata.items()]
  allkeys = list(set([x for sl in allkeys for x in sl]))
  print(allkeys)
  return jsonify({'counties':allkeys})









if __name__ == '__main__':
    app.run(debug=True,processes=4)
