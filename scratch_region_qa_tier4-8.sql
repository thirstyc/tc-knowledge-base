-- Tiers 4-8, complete global coverage — 34 countries × 3 = 102 rows
-- Greece, Israel, Turkey, Uruguay already have region-qa rows in the DB
-- (confirmed via SQL, no -en suffix on any existing row). Those 4 get a
-- "-2" suffix here, matching the precedent set in the Tier 3 batch.
-- The other 30 are genuinely new and use the clean convention.

INSERT INTO knowledge_chunks (content, source_doc, section_title, chunk_type) VALUES

-- TIER 4: MEDITERRANEAN & MIDDLE EAST
('Why does Turkish wine taste so unexpectedly serious? 6,000+ years of vines, though most grapes historically went to raisins, not bottles. Cappadocia''s volcanic soil, Thrace''s Aegean breeze. Indigenous grapes like Öküzgözü and Boğazkere finally getting real winemaking attention.', 'qa-region-turkey-style-2', 'Intermediate', 'region-qa'),
('What pairs with Turkish wine? Grilled kebabs. Meze spreads. Stuffed peppers. Turkish coffee to close. Bold reds want char; whites want the meze table.', 'qa-region-turkey-pairing-2', 'Beginner', 'region-qa'),
('Why does Turkey matter? One of the oldest wine-growing countries on Earth, yet mostly known for raisins and table grapes. Modern winemakers are finally bottling what the land was always capable of. Ancient origin, untapped potential.', 'qa-region-turkey-positioning-2', 'Beginner', 'region-qa'),

('Why does Israeli wine taste so polished? Judean Hills altitude, Negev desert extremes, Napa-style winemaking rigor since the 1880s revival. Mediterranean warmth with cool-night acidity. Precision over tradition.', 'qa-region-israel-style-2', 'Intermediate', 'region-qa'),
('What pairs with Israeli wine? Grilled lamb. Hummus and za''atar spreads. Shakshuka. Kosher wine now serious enough for a real dinner table, not just ceremony.', 'qa-region-israel-pairing-2', 'Beginner', 'region-qa'),
('Why does Israel matter? A modern wine industry built from scratch in under 150 years, now competing on quality with places that had a thousand-year head start. Innovation plus geopolitical complexity, always in the background.', 'qa-region-israel-positioning-2', 'Beginner', 'region-qa'),

('Why does Armenian wine taste so ancient and mineral? High-altitude vineyards, continental extremes, indigenous grapes found nowhere else. Some of the oldest winemaking evidence on Earth was dug up here — a 6,100-year-old winery.', 'qa-region-armenia-style', 'Intermediate', 'region-qa'),
('What pairs with Armenian wine? Khorovats (grilled meat skewers). Lavash and cheese. Pomegranate-glazed dishes. Rustic, smoky food for rustic, mineral wine.', 'qa-region-armenia-pairing', 'Beginner', 'region-qa'),
('Why does Armenia matter? The Areni-1 cave winery is the oldest known winemaking facility in the world. Small, family-run, still mostly undiscovered outside the region. Wine here predates most civilizations still standing.', 'qa-region-armenia-positioning', 'Beginner', 'region-qa'),

('Why does Greek Xinomavro taste so structured and savory? Cool continental sites in Naoussa, high tannin, high acid, almost no fruit sweetness. Tomato and olive, not jam. Often called the Burgundy of Greece for a reason.', 'qa-region-greece-style-2', 'Intermediate', 'region-qa'),
('What pairs with Greek wine? Grilled octopus. Feta and olives. Slow-roasted lamb. Mezze platters built for sharing, not sipping alone.', 'qa-region-greece-pairing-2', 'Beginner', 'region-qa'),
('Why does Greece matter? The wine god Dionysus was Greek before he was anyone else''s. Twenty years of quality-focused replanting turned a stereotype into a serious wine country. Ancient origin, modern reinvention.', 'qa-region-greece-positioning-2', 'Beginner', 'region-qa'),

('Why does Moroccan wine taste so structured for North Africa? Atlas Mountain altitude cools what would otherwise be brutal Mediterranean heat. French colonial winemaking technique never fully left. Syrah and Cabernet built with real backbone.', 'qa-region-morocco-style', 'Intermediate', 'region-qa'),
('What pairs with Moroccan wine? Lamb tagine. Spiced couscous. Preserved lemon dishes. Wine that can stand up to cumin and cinnamon without disappearing.', 'qa-region-morocco-pairing', 'Beginner', 'region-qa'),
('Why does Morocco matter? An African wine story that rarely gets told, propped up by French colonial-era vineyards and now finding its own identity. Small production, real ambition, an emerging frontier most people never think to look for.', 'qa-region-morocco-positioning', 'Beginner', 'region-qa'),

('Why does Tunisian wine taste so sun-baked and structured? Mediterranean limestone soils, Carthaginian and Roman winemaking roots going back millennia. Muscat goes floral and heady; Syrah goes dark and dense.', 'qa-region-tunisia-style', 'Intermediate', 'region-qa'),
('What pairs with Tunisian wine? Grilled merguez. Harissa-spiced fish. Couscous with vegetables. Wine built to handle heat, both in the glass and on the plate.', 'qa-region-tunisia-pairing', 'Beginner', 'region-qa'),
('Why does Tunisia matter? Wine here predates the Roman Empire, tracing back to Carthage. Modern production stayed small and quality-focused instead of chasing volume. A North African heritage story most wine lists skip entirely.', 'qa-region-tunisia-positioning', 'Beginner', 'region-qa'),

('Why does Egyptian wine taste like a genuine curiosity? Nile Valley heat, desert extremes, irrigation doing the work rainfall can''t. Small-scale, mostly domestic, built more on ambition than ideal terroir.', 'qa-region-egypt-style', 'Intermediate', 'region-qa'),
('What pairs with Egyptian wine? Grilled kofta. Molokhia stew. Mezze with flatbread. Simple food for a wine industry still finding its footing.', 'qa-region-egypt-pairing', 'Beginner', 'region-qa'),
('Why does Egypt matter? Pharaonic tomb paintings show winemaking scenes older than almost anything else on Earth. Modern Egyptian wine is a novelty more than a destination, but the lineage is real. Ancient legacy, tiny modern footprint.', 'qa-region-egypt-positioning', 'Beginner', 'region-qa'),

-- TIER 5: AMERICAS BEYOND BIG THREE
('Why does Baja California wine taste so bold? Desert terroir, ocean-cooled nights, old-vine Grenache and Nebbiolo pushed to their limits. Wild, sun-drenched, unapologetically intense.', 'qa-region-mexico-style', 'Intermediate', 'region-qa'),
('What pairs with Mexican wine? Carne asada. Chiles en nogada. Grilled fish tacos. Spice-forward food that most delicate wines can''t survive — this one can.', 'qa-region-mexico-pairing', 'Beginner', 'region-qa'),
('Why does Mexico matter? The oldest wine region in the Americas, dating to the 1500s — older than anything in the US or Argentina. Tequila and mezcal stole the spotlight for centuries. Baja is finally getting its due.', 'qa-region-mexico-positioning', 'Beginner', 'region-qa'),

('Why does Brazilian sparkling taste so fresh despite the tropics? High-altitude vineyards in Rio Grande do Sul dodge the heat that ruins lowland fruit. Portuguese colonial roots, cool nights doing the real work.', 'qa-region-brazil-style', 'Intermediate', 'region-qa'),
('What pairs with Brazilian wine? Feijoada. Grilled picanha. Passion fruit desserts with the sparkling stuff. Bold food, bright acid.', 'qa-region-brazil-pairing', 'Beginner', 'region-qa'),
('Why does Brazil matter? Proof that tropical countries can make serious wine if they climb high enough. Sparkling wine is the breakout category. A South American frontier still mostly unknown outside its own borders.', 'qa-region-brazil-positioning', 'Beginner', 'region-qa'),

('Why does Peruvian wine taste so bright? Andean altitude, intense UV, huge diurnal swings between blazing days and freezing nights. Grapes ripen slowly and hang onto acidity most low-altitude regions lose.', 'qa-region-peru-style', 'Intermediate', 'region-qa'),
('What pairs with Peruvian wine? Ceviche. Lomo saltado. Aji-spiced dishes. Altitude wine wants acid-driven food, not heavy sauces.', 'qa-region-peru-pairing', 'Beginner', 'region-qa'),
('Why does Peru matter? Pisco has always overshadowed Peruvian wine, but the same Andean altitude that makes the brandy special is now making the wine special too. Small, emerging, altitude-defined.', 'qa-region-peru-positioning', 'Beginner', 'region-qa'),

('Why does Uruguayan Tannat taste so structured? Atlantic-cooled coastal sites, clay soils, a grape so tannic in Bordeaux it needed decades to soften. Uruguay tamed it into something drinkable young without losing the grip.', 'qa-region-uruguay-style-2', 'Intermediate', 'region-qa'),
('What pairs with Uruguayan wine? Asado (Uruguayan barbecue). Grilled chorizo. Aged cheese. Tannat was basically built for a live-fire grill.', 'qa-region-uruguay-pairing-2', 'Beginner', 'region-qa'),
('Why does Uruguay matter? More Tannat planted here than in its native Madiran, France. A small, quality-obsessed industry that decided to own one grape completely instead of chasing every trend. South American gem, single-grape mastery.', 'qa-region-uruguay-positioning-2', 'Beginner', 'region-qa'),

('Why does Bolivian wine taste so intensely fruity? Vineyards above 3,000 meters — some of the highest on Earth. Thin air, brutal UV, thick-skinned grapes forced to concentrate everything. Nothing about this terroir is gentle.', 'qa-region-bolivia-style', 'Intermediate', 'region-qa'),
('What pairs with Bolivian wine? Salteñas. Grilled llama. Spiced stews. Altitude-grown intensity needs equally intense food.', 'qa-region-bolivia-pairing', 'Beginner', 'region-qa'),
('Why does Bolivia matter? The literal highest vineyards on the planet. A frontier story built on extremity rather than tradition. Niche, indigenous-grape-driven, barely known outside South America.', 'qa-region-bolivia-positioning', 'Beginner', 'region-qa'),

('Why does Paraguayan wine taste so rustic? Subtropical humidity, Mission grape heritage from Spanish colonial missions, small family plots doing everything by hand. Not polished — genuinely rough-edged.', 'qa-region-paraguay-style', 'Intermediate', 'region-qa'),
('What pairs with Paraguayan wine? Chipa (cheese bread). Grilled sausage. Simple, humble food for a simple, humble wine scene.', 'qa-region-paraguay-pairing', 'Beginner', 'region-qa'),
('Why does Paraguay matter? One of South America''s true undiscovered wine countries, still built almost entirely on family wineries with zero export ambition. If undiscovered has a floor, this might be it.', 'qa-region-paraguay-positioning', 'Beginner', 'region-qa'),

('Why does Ecuadorian wine taste so vivid? Equatorial altitude, cloud forest humidity, a growing season with almost no real seasons at all. High-altitude acid meets tropical ripeness in a way few places can replicate.', 'qa-region-ecuador-style', 'Intermediate', 'region-qa'),
('What pairs with Ecuadorian wine? Ceviche. Llapingachos (potato cakes). Grilled tilapia. Bright, acid-forward wine for bright, acid-forward food.', 'qa-region-ecuador-pairing', 'Beginner', 'region-qa'),
('Why does Ecuador matter? Shares the Andean altitude story with Peru and Bolivia but stays even smaller and more quality-obsessed. A frontier within a frontier.', 'qa-region-ecuador-positioning', 'Beginner', 'region-qa'),

('Why does Colombian wine taste so unusual? Vineyards near the equator can harvest twice a year — no real winter to force a single vintage. High altitude keeps it from tasting like a tropical mess. Genuinely strange terroir science.', 'qa-region-colombia-style', 'Intermediate', 'region-qa'),
('What pairs with Colombian wine? Bandeja paisa. Grilled arepas. Tropical fruit desserts. Food as varied as the country''s microclimates.', 'qa-region-colombia-pairing', 'Beginner', 'region-qa'),
('Why does Colombia matter? Equatorial viticulture breaks most of the rules wine regions live by. Tiny production, real curiosity value, an emerging frontier built on defying convention rather than following it.', 'qa-region-colombia-positioning', 'Beginner', 'region-qa'),

-- TIER 6: ASIA-PACIFIC
('Why does Chinese wine taste increasingly Bordeaux-like? Ningxia''s high-altitude desert and Yantai''s coastal climate were both developed with heavy Bordeaux-style influence — imported consultants, imported clones, ambitious money.', 'qa-region-china-style', 'Intermediate', 'region-qa'),
('What pairs with Chinese wine? Peking duck. Sichuan hot pot (bold reds only). Soy-glazed dishes. Built to hold up against big, savory flavors.', 'qa-region-china-pairing', 'Beginner', 'region-qa'),
('Why does China matter? The 12th largest wine producer on Earth, even after a real production decline in recent years. Geopolitically significant, still finding its own identity between imitation and originality. Massive potential, still modernizing.', 'qa-region-china-positioning', 'Beginner', 'region-qa'),

('Why does Japanese Pinot Noir taste so restrained and precise? Yamanashi and Nagano''s cool-climate sites, meticulous canopy management, a national obsession with doing everything exactly right. Subtle over showy, every time.', 'qa-region-japan-style', 'Intermediate', 'region-qa'),
('What pairs with Japanese wine? Washoku. Grilled fish. Light dashi-based broths. Umami-driven food that would flatten a bigger, louder wine.', 'qa-region-japan-pairing', 'Beginner', 'region-qa'),
('Why does Japan matter? A sake country that decided to take grape wine just as seriously. Quality over volume, precision over tradition-for-tradition''s-sake. Positioned as luxury, made like it.', 'qa-region-japan-positioning', 'Beginner', 'region-qa'),

('Why does Indian wine taste so unexpectedly fresh? Nashik''s high altitude and monsoon-influenced climate cool what should be brutal subcontinental heat. Sula led the charge; the rest of the industry is catching up fast.', 'qa-region-india-style', 'Intermediate', 'region-qa'),
('What pairs with Indian wine? Tandoori dishes. Paneer tikka. Mild curries — the spicier ones need beer, not wine, and that''s fine.', 'qa-region-india-pairing', 'Beginner', 'region-qa'),
('Why does India matter? A domestic wine culture exploding alongside a rising middle class, with international quality ambitions right behind it. Massive population, massive growth potential, still early days.', 'qa-region-india-positioning', 'Beginner', 'region-qa'),

('Why does Vietnamese wine taste so surprising? Dalat''s high-altitude cool climate is the only reason wine works here at all. French colonial vines never really took root, but modern ambition is filling the gap.', 'qa-region-vietnam-style', 'Intermediate', 'region-qa'),
('What pairs with Vietnamese wine? Pho (delicate whites only). Grilled lemongrass pork. Fresh herbs and lime. Bright food wants bright wine.', 'qa-region-vietnam-pairing', 'Beginner', 'region-qa'),
('Why does Vietnam matter? A Southeast Asian wine frontier riding a growing middle class and rising wine curiosity. Tiny production, genuine novelty, worth watching more than drinking — for now.', 'qa-region-vietnam-positioning', 'Beginner', 'region-qa'),

('Why does Korean ice wine taste so concentrated? Brutal winter cold does the same job it does in Canada — freezing grapes on the vine to concentrate sugar and acid before pressing. A cold-climate specialty out of necessity.', 'qa-region-south-korea-style', 'Intermediate', 'region-qa'),
('What pairs with Korean wine? Korean barbecue. Spicy banchan. Sweet-and-savory glazed dishes. Ice wine specifically wants dessert or blue cheese.', 'qa-region-south-korea-pairing', 'Beginner', 'region-qa'),
('Why does South Korea matter? An unlikely wine frontier built on the same cold-climate logic that made Canadian ice wine famous. Small, boutique, mostly a curiosity for now, but a real innovation story underneath.', 'qa-region-south-korea-positioning', 'Beginner', 'region-qa'),

('Why does Thai wine taste like a genuine experiment? Tropical heat and humidity are everything wine grapes hate, yet high-altitude and coastal microclimates make it barely possible. This shouldn''t work, and it mostly doesn''t — yet.', 'qa-region-thailand-style', 'Intermediate', 'region-qa'),
('What pairs with Thai wine? Thai food overwhelms most wine, honestly. Try it with mild coconut curries or fresh spring rolls if you''re curious.', 'qa-region-thailand-pairing', 'Beginner', 'region-qa'),
('Why does Thailand matter? Tourism-driven, resort-adjacent, more novelty than serious wine country right now. Proof that ambition sometimes outruns terroir — and that''s a story too.', 'qa-region-thailand-positioning', 'Beginner', 'region-qa'),

-- TIER 7: AFRICA
('Why does Madagascar wine taste so distinct? Volcanic soils, island isolation, French colonial winemaking technique applied to a terroir nothing else on Earth quite matches. Small, strange, genuinely singular.', 'qa-region-madagascar-style', 'Intermediate', 'region-qa'),
('What pairs with Madagascar wine? Romazava (beef and greens stew). Grilled zebu. Vanilla-inflected desserts — the island practically invented the flavor pairing.', 'qa-region-madagascar-pairing', 'Beginner', 'region-qa'),
('Why does Madagascar matter? An island terroir story with almost no international footprint. French colonial roots, volcanic soil, total isolation — ingredients for something genuinely unique, if anyone ever gets to taste it.', 'qa-region-madagascar-positioning', 'Beginner', 'region-qa'),

('Why does Kenyan wine taste so fresh near the equator? Rift Valley altitude is the trick — cool nights at elevation cancel out equatorial heat. High acidity in a place that has no business having any.', 'qa-region-kenya-style', 'Intermediate', 'region-qa'),
('What pairs with Kenyan wine? Nyama choma (grilled meat). Tropical fruit salads. Coffee-adjacent desserts, in a country famous for coffee first.', 'qa-region-kenya-pairing', 'Beginner', 'region-qa'),
('Why does Kenya matter? High-altitude wine grown almost on the equator, where classic viticulture says it shouldn''t work. A safari-and-wine tourism convergence still mostly unexplored by the outside world.', 'qa-region-kenya-positioning', 'Beginner', 'region-qa'),

('Why does Tanzanian wine taste so cool for its latitude? Lake region altitude and colonial-era vineyard sites keep the heat in check. Small, quiet, barely on anyone''s radar.', 'qa-region-tanzania-style', 'Intermediate', 'region-qa'),
('What pairs with Tanzanian wine? Grilled tilapia. Nyama choma. Coconut-based stews from the coast. Simple food for a simple, emerging wine scene.', 'qa-region-tanzania-pairing', 'Beginner', 'region-qa'),
('Why does Tanzania matter? An East African frontier even less discovered than its neighbors. Tiny production, real potential, a genuine blank spot on most wine maps.', 'qa-region-tanzania-positioning', 'Beginner', 'region-qa'),

('Why does Zimbabwean wine taste like a survival story? High-altitude, cool-climate sites left over from the colonial Rhodesian era, kept alive through decades of economic collapse most industries wouldn''t have survived.', 'qa-region-zimbabwe-style', 'Intermediate', 'region-qa'),
('What pairs with Zimbabwean wine? Sadza with grilled meat. Peanut butter stews. Simple, hearty food from an industry that had to relearn simplicity to survive.', 'qa-region-zimbabwe-pairing', 'Beginner', 'region-qa'),
('Why does Zimbabwe matter? A wine industry that outlasted economic collapse most businesses never would. Boutique, family-run, resilient almost by definition. Southern African heritage, told through survival.', 'qa-region-zimbabwe-positioning', 'Beginner', 'region-qa'),

('Why does Namibian wine taste so coastal and crisp? Cool Atlantic air rolling off the Benguela Current cuts through what would otherwise be desert heat. A coastal cool-climate story in a country most people picture as pure sand.', 'qa-region-namibia-style', 'Intermediate', 'region-qa'),
('What pairs with Namibian wine? Grilled game meat. Biltong. Seafood off the coast. Crisp whites for a genuinely coastal terroir.', 'qa-region-namibia-pairing', 'Beginner', 'region-qa'),
('Why does Namibia matter? A Southern African frontier defined by coastal cool air instead of desert heat. Tiny, tourism-driven, boutique — proof terroir can surprise you anywhere.', 'qa-region-namibia-positioning', 'Beginner', 'region-qa'),

-- TIER 8: MICRO/ESTABLISHED
('Why does Canadian ice wine taste so honeyed and concentrated? Grapes frozen solid on the vine at -8°C or colder, pressed while frozen so only pure concentrated juice comes out. Niagara and the Okanagan do this better than almost anywhere on Earth.', 'qa-region-canada-style', 'Intermediate', 'region-qa'),
('What pairs with Canadian wine? Ice wine wants foie gras, blue cheese, or a simple spiced pastry. Ontario Riesling and BC Pinot Noir are dinner-table wines, not just dessert.', 'qa-region-canada-pairing', 'Beginner', 'region-qa'),
('Why does Canada matter? The undisputed ice wine leader worldwide, plus a quietly serious cool-climate Riesling and Pinot Noir scene, plus an emerging Quebec region nobody saw coming. Young industry, real credibility.', 'qa-region-canada-positioning', 'Beginner', 'region-qa'),

('Why does Dutch wine taste so unexpectedly crisp? Climate change turned a country that had no business growing wine grapes into a genuine cool-climate white and sparkling producer. Low-lying, damp, and somehow working.', 'qa-region-netherlands-style', 'Intermediate', 'region-qa'),
('What pairs with Dutch wine? Fresh oysters. Mild cheeses. Light seafood dishes. Crisp, high-acid wine built for a maritime table.', 'qa-region-netherlands-pairing', 'Beginner', 'region-qa'),
('Why does the Netherlands matter? Proof that climate change is redrawing the wine map in real time. A traditionally beer-and-gin country now making legitimate sparkling wine. European unexpected, entirely of the moment.', 'qa-region-netherlands-positioning', 'Beginner', 'region-qa'),

('Why does English sparkling wine taste so much like Champagne? Same chalk soils as the Champagne region, running underground beneath the English Channel. Warming climate finally lets Chardonnay and Pinot Noir ripen properly.', 'qa-region-united-kingdom-style', 'Intermediate', 'region-qa'),
('What pairs with English sparkling? Fish and chips. Oysters. Soft cheeses. Anything Champagne pairs with, this pairs with too.', 'qa-region-united-kingdom-pairing', 'Beginner', 'region-qa'),
('Why does the UK matter? English sparkling wine now beats French Champagne in blind tastings often enough that nobody''s laughing anymore. Climate change made an unlikely wine country genuinely dangerous to the establishment.', 'qa-region-united-kingdom-positioning', 'Beginner', 'region-qa'),

('Why does Belgian wine taste like a science project? A beer country experimenting with cool-climate grapes and fruit-wine hybrids because tradition never dictated otherwise. Flemish small-batch, genuinely exploratory.', 'qa-region-belgium-style', 'Intermediate', 'region-qa'),
('What pairs with Belgian wine? Moules-frites. Soft washed-rind cheeses. Belgian wine still loses to Belgian beer at the dinner table, and that''s fine.', 'qa-region-belgium-pairing', 'Beginner', 'region-qa'),
('Why does Belgium matter? A country famous for beer quietly building a wine identity almost nobody asked for. European curiosity more than European destination, and proud of it.', 'qa-region-belgium-positioning', 'Beginner', 'region-qa'),

('Why does Danish wine taste so lean and mineral? Cold-climate viticulture pushed further north than tradition ever allowed, made possible only by a warming climate and a lot of Nordic stubbornness.', 'qa-region-denmark-style', 'Intermediate', 'region-qa'),
('What pairs with Danish wine? New Nordic cuisine. Pickled fish. Foraged herbs. Lean, high-acid wine for a lean, precise cuisine.', 'qa-region-denmark-pairing', 'Beginner', 'region-qa'),
('Why does Denmark matter? Part of the broader Nordic wine movement betting that climate change opens doors instead of just closing them. Tiny, experimental, and genuinely buzzy in wine-nerd circles.', 'qa-region-denmark-positioning', 'Beginner', 'region-qa'),

('Why does Luxembourg wine taste so precise? Moselle river terroir shared with Germany, cool-climate Riesling and Müller-Thurgau grown with the same discipline as its bigger neighbors, just at a fraction of the scale.', 'qa-region-luxembourg-style', 'Intermediate', 'region-qa'),
('What pairs with Luxembourg wine? River fish. Ardennes ham. Soft, mild cheeses. Riesling wants exactly the food you''d expect.', 'qa-region-luxembourg-pairing', 'Beginner', 'region-qa'),
('Why does Luxembourg matter? A genuinely established wine region hiding inside a country most people can''t find on a map. Moselle river terroir, quality focus, Europe''s forgotten gem.', 'qa-region-luxembourg-positioning', 'Beginner', 'region-qa'),

('Why does Liechtenstein wine taste like a museum piece? Alpine terroir, minuscule production, wine made more as cultural heritage than commercial product. What little exists is treated like a relic worth preserving.', 'qa-region-liechtenstein-style', 'Intermediate', 'region-qa'),
('What pairs with Liechtenstein wine? Alpine cheese. Cured meats. Simple mountain food for a wine you''re unlikely to ever actually find.', 'qa-region-liechtenstein-pairing', 'Beginner', 'region-qa'),
('Why does Liechtenstein matter? One of the smallest wine-producing countries on Earth, kept alive purely as heritage rather than industry. A collector''s novelty more than a wine destination.', 'qa-region-liechtenstein-positioning', 'Beginner', 'region-qa'),

('Why does San Marino wine taste so classically Italian? Sangiovese and Trebbiano grown on UNESCO hillside terroir predating the Roman Empire. A micro-state that''s essentially Tuscany in miniature.', 'qa-region-san-marino-style', 'Intermediate', 'region-qa'),
('What pairs with San Marino wine? Italian classics — cured meats, aged cheese, tomato-based pasta. The food rules of nearby Italy apply here too.', 'qa-region-san-marino-pairing', 'Beginner', 'region-qa'),
('Why does San Marino matter? The world''s smallest wine-producing country by some measures, with wine traditions older than most nations still on the map. Micro-state heritage, hillside UNESCO terroir, a genuine novelty with real history behind it.', 'qa-region-san-marino-positioning', 'Beginner', 'region-qa');
