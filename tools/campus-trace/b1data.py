# Coordinates are pixels in the deskewed 6000px render crop (offset 3880,2650;
# rotated 1.005 deg). Map units = px / 10 with y shifted by 40 px.
import sys
# Old crop-deskew px -> page px (+3897.8, +2617.6) -> campus units ((page - (120, 1900)) / 10)
def X(v): return round((v + 3897.8 - 120) / 10, 1)
def Y(v): return round((v + 2617.6 - 1900) / 10, 1)
def fmt(v): return ('%g' % v)
def poly(points, close=True):
    d = 'M' + ' L'.join(f'{fmt(X(x))} {fmt(Y(y))}' for x, y in points)
    return d + (' Z' if close else '')
def hline(y, a, b): return poly([(a, y), (b, y)], False)
def vline(x, a, b): return poly([(x, a), (x, b)], False)
def rect(x0, y0, x1, y1): return poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])

# 2026-10-22 corrections from the user's annotations:
# * The gap between 2101 Drama and the Lunch Shelter was drawn too narrow. The
#   Lunch Shelter's edge now follows the PDF's inner west line (x 52), and
#   Building 2's Drama wall moves 32 px west (campus.py), making the gap ~3x wider.
# * The Lunch Shelter is a wide open area with no doors: its south and west
#   sides are open, so the building footprint and walls leave it out.
north = [(52,97),(372,97),(372,66),(531,66),(531,52),(738,52),(738,257),(1699,257),(1699,480),
         (1655,480),(1655,430),(487,430),(487,478),(246,478),(246,134),(52,134)]
north_walls = [(52,134),(52,97),(372,97),(372,66),(531,66),(531,52),(738,52),(738,257),(1699,257),(1699,480),
               (1655,480),(1655,430),(487,430),(487,478),(246,478)]
# Career Center: immediately west of the Library (user correction), below the T/ELEV block.
career = [(1355,784),(1483,784),(1483,860),(1355,860)]
east = [(1319,623),(1640,623),(1640,784),(1319,784)]
south_pts = [(67,927),(837,927),(837,972),(1485,972),(1485,1143),(760,1143),(760,1160),(695,1160)]
south = poly(south_pts, False) + f' Q{fmt(X(401))} {fmt(Y(1230))} {fmt(X(102))} {fmt(Y(1162))}' + \
    ' L' + ' L'.join(f'{fmt(X(x))} {fmt(Y(y))}' for x, y in [(102,1062),(67,1062)]) + ' Z'
library = (poly([(1483,1200),(1483,784),(1640,784),(1640,770),(1722,770),(1722,700)], False)
    + f' A{fmt(3.4)} {fmt(3.4)} 0 0 1 {fmt(X(1790))} {fmt(Y(700))}'
    + ' L' + ' L'.join(f'{fmt(X(x))} {fmt(Y(y))}' for x, y in [(1790,770),(1851,770),(1851,1210)])
    + f' Q{fmt(X(1734))} {fmt(Y(1319))} {fmt(X(1483))} {fmt(Y(1200))} Z')

solid = [poly(north_walls, False), poly([(1355,784),(1355,860),(1483,860)], False), rect(1319,623,1640,623+0) if False else poly([(1640,784),(1640,623),(1319,623),(1319,784),(1494,784)], False),
    south, poly([(1483,784),(1483,972)], False), poly([(1483,1143),(1483,1200)], False),
    poly([(1640,770),(1722,770),(1722,700)], False) + f' A3.4 3.4 0 0 1 {fmt(X(1790))} {fmt(Y(700))}'
      + ' L' + ' L'.join(f'{fmt(X(x))} {fmt(Y(y))}' for x, y in [(1790,770),(1851,770),(1851,1210)])
      + f' Q{fmt(X(1734))} {fmt(Y(1319))} {fmt(X(1483))} {fmt(Y(1200))}',
    vline(246,127,478), hline(134,52,379)]
dividers = [vline(x,257,430) for x in (733,827,918,1010,1158,1211,1360,1450,1545)] + \
    [hline(262,246,733), vline(495,134,262), vline(695,927,1160)] + \
    [vline(x,972,1143) for x in (818,913,1008,1103,1197,1291,1391,1485)] + \
    [hline(680,1322,1500), vline(1500,628,784), vline(1365,628,725)]
uncertain_lines = [
    ('Dashed line along the Quad side of the north row; meaning unknown', hline(475,487,1310)),
    ('Dashed outline east of the Quad; meaning unknown', vline(1318,480,625)),
    ('Dashed outline around the east stair symbol; meaning unknown', rect(1365,480,1530,600)),
    ('Dashed line west of the library; meaning unknown', vline(1575,480,620)),
    ('Dashed line along the Quad side of the south row; meaning unknown', hline(925,765,1318)),
    ('Dashed outline around the south stair symbol; meaning unknown', rect(765,855,1000,925)),
    ('Dashed line east of the Quad; meaning unknown', vline(1318,785,925)),
    ('Dashed line in the unlabeled space west of the kitchen', vline(435,66,134)),
    ('Small dashed box at the east end of the cafeteria; meaning unknown', rect(683,322,730,400)),
    ('Dashed line between Comp room and library', hline(784,1500,1640)),
]
def crossed(x0,y0,x1,y1): return rect(x0,y0,x1,y1) + ' ' + poly([(x0,y0),(x1,y1)], False) + ' ' + poly([(x1,y0),(x0,y1)], False)
def stair(x0,y0,x1,y1):
    d = rect(x0,y0,x1,y1)
    n = 4
    for i in range(1, n):
        y = y0 + (y1 - y0) * i / n
        d += ' ' + hline(y, x0, x1)
    return d
symbols = [
    ('Crossed-box symbol at the cafeteria corner (stair, shaft or utility?)', crossed(445,432,485,475)),
    ('Crossed-box symbol at the east end of the north row', crossed(1655,432,1698,478)),
    ('Crossed-box symbol in the east block', crossed(1325,727,1368,778)),
    ('Hatched stair symbol near the cafeteria', stair(543,478,622,595)),
    ('Hatched stair symbol north of the Career Center', stair(1418,510,1530,585)),
    ('Hatched stair symbol on the south side of the Quad', stair(820,860,985,905)),
]
# id, label, kind, status, x0,y0,x1,y1, rotate, label x,y (optional), note
rooms = [
    ('lunch-shelter','Lunch Shelter','area','documented',52,134,246,478,-90,None,'Wide open covered area with no doors; open on its south and west sides (user, 2026-10-22)'),
    ('student-area','Student Area','area','documented',-10,501,455,904,0,(220,700),'Open student area west of the Quad (PDF handwriting; user annotation)'),
    ('senior-hill','Senior Hill','area','documented',1135,620,1295,780,0,None,'Round student area at the middle-right edge of the Quad (user); boundary is a draft'),
    ('wellness-center','Wellness Center','area','documented',246,134,495,262,0,None,''),
    ('kitchen','Kitchen','area','documented',495,52,738,262,0,None,''),
    ('cafeteria','Cafeteria','area','documented',246,262,733,430,0,None,''),
    ('restroom-north','T','room','uncertain',733,257,827,430,0,None,'Label T is presumed to mean restroom'),
    ('room-1162','1162','room','documented',827,257,918,430,-90,None,''),
    ('room-1161','1161','room','documented',918,257,1010,430,-90,None,''),
    ('room-1160','1160','room','documented',1010,257,1158,430,-90,None,''),
    ('room-1-159','1-159','room','uncertain',1158,257,1211,430,-90,None,'Label partly illegible: 1159, 1-159 or a closet'),
    ('room-1158','1158','room','documented',1211,257,1360,430,-90,None,''),
    ('room-1157','1157','room','documented',1360,257,1450,430,-90,None,''),
    ('room-1156','1156','room','documented',1450,257,1545,430,-90,None,''),
    ('room-1155','1155','room','documented',1545,257,1696,430,-90,None,''),
    ('quad','Quad','area','documented',500,480,1310,920,0,(905,675),'Open area; no boundary is drawn in the source'),
    ('restroom-east-1','T','room','uncertain',1322,628,1365,680,0,None,'Label T is presumed to mean restroom'),
    ('restroom-east-2','T','room','uncertain',1322,680,1365,725,0,None,'Label T is presumed to mean restroom'),
    ('elev-m','ELEV. M.','room','uncertain',1365,628,1500,680,0,None,'Elevator or elevator machine room: unverified'),
    ('career-center','Career Center','area','documented',1355,784,1483,860,0,None,'Next to the Library (user correction); the PDF prints the name in the block above'),
    ('comp-room','Comp','room','uncertain',1500,628,1640,784,-90,None,'Second line of the label is illegible'),
    ('admin-offices','Admin Offices','area','documented',102,927,695,1160,0,(410,1045),'Interior layout not documented'),
    ('room-1138','1138','room','documented',695,927,818,1150,-90,None,''),
    ('room-1139','1139','room','documented',818,972,913,1143,-90,None,''),
    ('room-1140','1140','room','documented',913,972,1008,1143,-90,None,''),
    ('room-1141','1141','room','documented',1008,972,1103,1143,-90,None,''),
    ('room-1142','1142','room','documented',1103,972,1197,1143,-90,None,''),
    ('room-1143','1143','room','documented',1197,972,1291,1143,-90,None,''),
    ('room-1144','1144','room','documented',1291,972,1391,1143,-90,None,''),
    ('book-room','BookRm','room','documented',1391,972,1485,1143,-90,None,'Book room'),
    ('library','Library','area','documented',1485,784,1851,1200,0,(1665,1000),'Interior layout not documented'),
    ('third-street','Third Street','context','documented',700,1170,1300,1270,0,(980,1220),'Street name for orientation'),
    ('harvard-road','Harvard Road','context','documented',1700,60,1900,560,90,(1800,300),'Street name for orientation'),
]
