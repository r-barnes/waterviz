#!/usr/bin/env python3
import os
from flask import Flask, jsonify, send_from_directory, abort, Response, request
import psycopg2

app = Flask(__name__)

conn = psycopg2.connect("dbname='rivers' user='nelson' host='localhost' password='NONE'")

#@app.route('/')
#def index():
#  return send_from_directory('.', 'index.html')

@app.route('/gauges/list/<string:xmin>/<string:ymin>/<string:xmax>/<string:ymax>', methods=['GET'])
def show_gaugelist(xmin,ymin,xmax,ymax):
  print('hi')
  cur = conn.cursor()

  cur.execute("""
    SELECT *, ST_X(the_geom) as lng, ST_Y(the_geom) as lat
    FROM   gageloc
    WHERE  geom
        @ -- contained by, gets fewer rows -- ONE YOU NEED!
        ST_MakeEnvelope (
            %(xmin)s, %(ymin)s, -- bounding
            %(xmax)s, %(ymax)s, -- box limits
            900913)
  """, {"xmin":xmin,"ymin":ymin,"xmax":xmax,"ymax":ymax})

  print(cur.fetchall())

  return Response("hi", mimetype='text')
  #return Response(outcss, mimetype='text/css')

if __name__ == '__main__':
    app.run(debug=True)
