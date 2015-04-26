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
  fin.next() #Skip units line

  data = list(fin)

  if not data:
    continue

  key60 = filter(fin.keys(), lambda x: x.endswith('_00060_00003'))
  key65 = filter(fin.keys(), lambda x: x.endswith('_00065_00003'))

  if not key60 and not key65:
    print ('%s had no discharge or stage.' % (fname))
    continue

  for i in data:
    if key60: #Discharge
      i['dvalue'] = i[key60[0]]
      i['drank']  = scipy.stats.percentileofscore(historic_data[i['site_no']],i['dvalue'])
    else:
      i['dvalue'] = None
      i['drank']  = None
    if key65: #Stage
      i['svalue'] = i[key65[0]]
    else:
      i['svalue'] = None

  cur.executemany("""
WITH new_values (site_code,dvalue,svalue,drank,jday) AS (
  VALUES (%(site_code)s, CAST(%(dvalue)s AS REAL), CAST(%(svalue)s AS REAL), CAST(%(drank)s AS REAL), %(datetime)s::date-'1970-01-01'::date)
),
upsert AS
(
    UPDATE reach_summary m
        SET dvalue = GREATEST(m.dvalue,nv.dvalue),
            svalue = GREATEST(m.svalue,nv.svalue),
            drank  = GREATEST(m.drank, nv.drank )
    FROM new_values nv
    WHERE m.site_code = nv.site_code AND m.jday=nv.jday
    RETURNING m.*
)
INSERT INTO reach_summary (site_code,dvalue,svalue,drank,jday)
SELECT site_code,dvalue,svalue,drank,jday
FROM new_values
WHERE NOT EXISTS (SELECT 1
                  FROM upsert up
                  WHERE up.site_code = new_values.site_code AND up.jday = new_values.jday)
""", data)

  conn.commit()