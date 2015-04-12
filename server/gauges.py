#!/usr/bin/env python3
import os
from flask import Flask, jsonify, send_from_directory, abort, Response, request
import psycopg2

app = Flask(__name__)

conn = psycopg2.connect("dbname='rivers' user='nelson' host='localhost' password='NONE'")

#@app.route('/')
#def index():
#  return send_from_directory('.', 'index.html')

@app.route('/gaugelist/<float:xmin>/<float:ymin>/<float:xmax>/<float:ymax>', methods=['GET'])
def gaugelist(xmin,ymin,xmax,ymax):
  cur = conn.cursor()

  cur.execute("""
    SELECT *
    FROM   my_table
    WHERE  coordinates
        @ -- contained by, gets fewer rows -- ONE YOU NEED!
        ST_MakeEnvelope (
            %(xmin)f, %(ymin)f, -- bounding
            %(xmax)f, %(ymax)f, -- box limits
            900913)
  """, {"xmin":xmin,"ymin":ymin,"xmax":xmax,"ymax":ymax})

  return Response("hi", mimetype='text')
  #return Response(outcss, mimetype='text/css')

if __name__ == '__main__':
    app.run(debug=True)