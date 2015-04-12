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
    SELECT  ST_X(geom) as lng, ST_Y(geom) as lat
    FROM   gageloc
    WHERE  geom
        @ -- contained by, gets fewer rows -- ONE YOU NEED!
        ST_MakeEnvelope (
            %(xmin)s, %(ymin)s, -- bounding
            %(xmax)s, %(ymax)s, -- box limits
            900913) order by random() LIMIT 500
  """, {"xmin":xmin,"ymin":ymin,"xmax":xmax,"ymax":ymax})

  return json.dumps(cur.fetchall())

if __name__ == '__main__':
    app.run(debug=True)
