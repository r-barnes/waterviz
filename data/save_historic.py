#!/usr/bin/env python
import glob
import csv
import psycopg2
import psycopg2.extras
import scipy.stats
import numpy as np

conn = psycopg2.connect("dbname='rivers' user='nelson' host='localhost' password='NONE'")
cur  = conn.cursor(cursor_factory = psycopg2.extras.RealDictCursor)

cur.execute("SELECT site_no, array_to_string(array_agg(ave), ',') AS yearly_ave FROM (SELECT site_no, ave FROM gage_smooth WHERE month=13 AND year>=1985 ORDER BY site_no,ave) a GROUP BY site_no")
historic_data = {}
for i in cur.fetchall():
  temp = np.fromstring(i['yearly_ave'], dtype=float, sep=',')
  historic_data[i['site_no']] = temp

filecount = len(glob.glob('gages_historic/*_historic.dat'))

for i,fname in enumerate(glob.glob('gages_historic/*_historic.dat')):
  print ("Working on '%s' (%d of %d)" % (fname,i+1,filecount))
  fin = open(fname,'r')
  fin = csv.DictReader((row for row in fin if not row.startswith('#')),dialect='excel-tab',delimiter='\t',skipinitialspace=True)
  try:
    fin.next() #Skip units line
  except:
    continue

  data = list(fin)

  if not data:
    continue

  key60 = filter(lambda x: x.endswith('_00060_00003'), data[0].keys())
  key65 = filter(lambda x: x.endswith('_00065_00003'), data[0].keys())

  if not key60 and not key65:
    print ('%s had no discharge or stage.' % (fname))
    continue

  for i in data:
    if key60: #Discharge
      i['dvalue'] = i[key60[0]]
      if not i['dvalue']: #Filter empty strings
        i['dvalue'] = None
      if i['site_no'] in historic_data:
        i['drank'] = scipy.stats.percentileofscore(historic_data[i['site_no']],i['dvalue'])
      else:
        i['drank'] = None
    else:
      i['dvalue'] = None
      i['drank']  = None
    if key65: #Stage
      i['svalue'] = i[key65[0]]
      if not i['svalue']: #Filter empty strings
        i['svalue'] = None
    else:
      i['svalue'] = None

  try:
    cur.executemany("""INSERT INTO gauge_summary (site_code,dvalue,svalue,drank,jday) VALUES (%(site_no)s, CAST(%(dvalue)s AS REAL), CAST(%(svalue)s AS REAL), CAST(%(drank)s AS REAL), %(datetime)s::date-'1970-01-01'::date)""")
  except:
    conn.rollback()
    continue

  conn.commit()