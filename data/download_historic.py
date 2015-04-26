#!/usr/bin/env python
#Download all historic data for all stations in gage_smooth
import urllib
import psycopg2
import psycopg2.extras
import os

if not os.path.exists('gages_historic'):
  os.makedirs('gages_historic')

conn = psycopg2.connect("dbname='rivers' user='nelson' host='localhost' password='NONE'")
cur  = conn.cursor(cursor_factory = psycopg2.extras.RealDictCursor)

cur.execute("SELECT site_no FROM gage_smooth")

for site in cur.fetchall():
  url = "http://waterdata.usgs.gov/nwis/dv?cb_00065=on&cb_00060=on&format=rdb&site_no=SITE_NUMBER&referred_module=sw&period=&begin_date=2007-10-01&end_date=2015-04-24"
  url = url.replace('SITE_NUMBER',site['site_no'])
  print("Fetching %s" % (site['site_no']))
  testfile = urllib.URLopener()
  testfile.retrieve(url, 'gages_historic/'+site['site_no']+'_historic.dat')