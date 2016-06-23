var port = process.env.PORT || 5000;
var express = require('express');
var expressSession = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var omdb = require('./index.js');
var app = express();

var cons = require('consolidate');
app.engine('html', cons.swig);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

app.use(cookieParser());
app.use(expressSession({secret:'MusSecret'}));
app.use(bodyParser());
app.use("/public",express.static(__dirname + "/public"));
//app.use(express.static(__dirname + '/assets'));

var mongoose = require('mongoose');
var uristring = process.env.MONGOLAB_URI || 'mongodb://localhost/dizi9';
mongoose.connect(uristring);

var userSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	email: {type: String, required: true}
});
var seriesSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	series: [{}]
});
var episodesSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	series: [{
		serie_id: String,
		season_number: String,
		watched_episodes: []
	}]
});

var User = mongoose.model('User', userSchema);
var Series = mongoose.model('Series', seriesSchema);
var Episodesdb = mongoose.model('Episodesdb', episodesSchema);

var sendgrid  = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);

var server = app.listen(port);

var x;
app.get('/', function (req, res) {
	if(req.session.user)
		res.redirect('/main');
	else
		res.render('index');
});
app.post('/login',function(req,res){
	delete req.session.user;
	delete req.session.email;
	var post = req.body;
	User.findOne({ 'username': post.user }, function(err, user) {
		if (err) throw err;
		if(user && post.password == user.password){
			req.session.user = user.username;
			req.session.email = user.email;
			console.log(req.session.user + " logged in.");
			res.redirect('/main');
		}
		else res.render('index', { message: "Kullanici Adi veya Sifre hatali!"});
	});
});
app.post('/main', function(req,res){
	res.redirect('/main');
});
app.get('/main', function (req, res) {
	if(req.session.user) {
		Series.findOne({'username' : req.session.user}, function(err, Serie){
			res.render('main', {
				username: req.session.user,
				email: req.session.email,
				dizilerim: Serie.series
			});
		});

	}
	else
		res.redirect('/');
});

app.post('/signup', function (req, res) {
	var post = req.body;
	req.session.user = post.adduser;
	req.session.email = post.addemail;
	var new_user = new User({
		username: req.session.user,
		password: post.addpassword,
		email: req.session.email
	});
	var new_series = new Series({
		username: req.session.user,
		series: []
	});
	var new_episodes = new Episodesdb({
		username: req.session.user,
		series: []
	});
	new_episodes.save(function(err,new_episodes){
		if(err) {}
	});
	new_series.save(function(err, new_series){
		if(err) {}
	});
	new_user.save(function (err, new_user) {
		if (err) {
			delete req.session.user;
			delete req.session.email;
			
			res.render('kayitol', { message: "Bu kullanici adi baskasi tarafindan kullaniliyor!"});
			console.log(req.session.user + " kullanici adi zaten kullaniliyor!")
		}
		else{
			if(req.session.user) {
				res.render('index', {message: req.session.user + " eklendi!"});
				console.log(req.session.user + " " + post.addpassword + ' basariyla eklendi!');
			}
			else
				res.redirect('/');
		}
	});
});

app.post('/delete', function (req, res) {
	var deleted_user = req.session.user;
	User.findOneAndRemove({ username: req.session.user }, function(err) {
		if (err) throw err;
		console.log(deleted_user + ' deleted!');
	});
	delete req.session.user;
	delete req.session.email;
	res.redirect('/');
});
app.post('/logout', function (req, res) {
	delete req.session.user;
	delete req.session.email;
	res.redirect('/');
});
app.get('/cikisYap', function (req, res) {
	if(req.session.user){
		delete req.session.user;
		delete req.session.email;
	}
	res.redirect('/');
});
app.post('/gotodiziara', function(req,res){
	res.redirect('diziAra');
});
app.get('/diziAra', function(req,res){
	if(req.session.user){
		res.render('diziara', {
			username: req.session.user,
			email: req.session.email
		});
	}
	else{
		res.redirect('/');
	}
});
app.post('/diziAra', function(req,res){
	var post = req.body;
	if(post.serieName) {
		omdb.search({terms: post.serieName, type: 'series'}, function (err, series) {
			if (err) {
				console.error(err);
			}
			if (series.length < 1) {
				console.log('No series were found!');
				Series.findOne({'username' : req.session.user}, function(err, Serie){
					if(err) throw err;
					res.render('diziara', {
						username: req.session.user,
						email: req.session.email,
						diziBulunamadi: 'Dizi Bulunamadi.',
						serieName : post.serieName
					});
				});

				return;
			}
			Series.findOne({'username' : req.session.user}, function(err, Serie){
				if(err) throw err;
				res.render('diziara', {
					username: req.session.user,
					email: req.session.email,
					series: series,
					serieName : post.serieName
				});
			});
		});
	}
	else
		res.redirect('/');

});
app.get('/dizi/:diziid', function(req,res){
	if(req.session.user) {
		var diziid = req.params.diziid;
		omdb.get({imdb: diziid}, function (err, serie) {
			if (err) {
				console.error(err);
				return;
			}

			res.render('diziinfo', {
				username: req.session.user,
				serie: serie
			});
		});
	}
	else
		res.redirect('/');
});

app.get('/dizilerim/:diziid', function(req,res){
	if(req.session.user) {
		var diziid = req.params.diziid;
		Series.findOne({"username": req.session.user, "series":{"$elemMatch":{"serie_id": diziid}}},{"series.$":1}, function(err,data) {
			if (err) throw err;
			if (data) {

			omdb.get({imdb: diziid}, function (err, serie) {
				if (err) {
					console.error(err);
					return;
				}
				var sezonSayisi;
				omdb.getEpisodes({imdb: diziid, Season: 1}, function (err, data1) {
					if (err) {
						console.error(err);
						return;
					}
					omdb.getEpisodes({imdb: diziid, Season: 2}, function (err, data2) {
						if (err) {
							console.error(err);
							return;
						}
						if (data2.response == "False") {
							sezonSayisi = [1];
							res.render('dizileriminfo', {
								username: req.session.user,
								serie: serie,
								seasons: sezonSayisi
							});
							return;
						}

						omdb.getEpisodes({imdb: diziid, Season: 3}, function (err, data3) {
							if (err) {
								console.error(err);
								return;
							}
							if (data3.response == "False") {
								sezonSayisi = [1, 2];
								res.render('dizileriminfo', {
									username: req.session.user,
									serie: serie,
									seasons: sezonSayisi
								});
								return;
							}
							omdb.getEpisodes({imdb: diziid, Season: 4}, function (err, data4) {
								if (err) {
									console.error(err);
									return;
								}
								if (data4.response == "False") {
									sezonSayisi = [1, 2, 3];
									res.render('dizileriminfo', {
										username: req.session.user,
										serie: serie,
										seasons: sezonSayisi
									});
									return;
								}
								omdb.getEpisodes({imdb: diziid, Season: 5}, function (err, data5) {
									if (err) {
										console.error(err);
										return;
									}
									if (data5.response == "False") {
										sezonSayisi = [1, 2, 3, 4];
										res.render('dizileriminfo', {
											username: req.session.user,
											serie: serie,
											seasons: sezonSayisi
										});
										return;
									}
									omdb.getEpisodes({imdb: diziid, Season: 6}, function (err, data6) {
										if (err) {
											console.error(err);
											return;
										}
										if (data6.response == "False") {
											sezonSayisi = [1, 2, 3, 4, 5];
											res.render('dizileriminfo', {
												username: req.session.user,
												serie: serie,
												seasons: sezonSayisi
											});
											return;
										}
										omdb.getEpisodes({imdb: diziid, Season: 7}, function (err, data7) {
											if (err) {
												console.error(err);
												return;
											}
											if (data7.response == "False") {
												sezonSayisi = [1, 2, 3, 4, 5, 6];
												res.render('dizileriminfo', {
													username: req.session.user,
													serie: serie,
													seasons: sezonSayisi
												});
												return;
											}
											omdb.getEpisodes({imdb: diziid, Season: 8}, function (err, data8) {
												if (err) {
													console.error(err);
													return;
												}
												if (data8.response == "False") {
													sezonSayisi = [1, 2, 3, 4, 5, 6, 7];
													res.render('dizileriminfo', {
														username: req.session.user,
														serie: serie,
														seasons: sezonSayisi
													});
													return;
												}
												omdb.getEpisodes({imdb: diziid, Season: 9}, function (err, data9) {
													if (err) {
														console.error(err);
														return;
													}
													if (data9.response == "False") {
														sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8];
														res.render('dizileriminfo', {
															username: req.session.user,
															serie: serie,
															seasons: sezonSayisi
														});
														return;
													}
													omdb.getEpisodes({
														imdb: diziid,
														Season: 10
													}, function (err, data10) {
														if (err) {
															console.error(err);
															return;
														}
														if (data10.response == "False") {
															sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9];
															res.render('dizileriminfo', {
																username: req.session.user,
																serie: serie,
																seasons: sezonSayisi
															});
															return;
														}
														omdb.getEpisodes({
															imdb: diziid,
															Season: 11
														}, function (err, data11) {
															if (err) {
																console.error(err);
																return;
															}
															if (data11.response == "False") {
																sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
																res.render('dizileriminfo', {
																	username: req.session.user,
																	serie: serie,
																	seasons: sezonSayisi
																});
																return;
															}
															omdb.getEpisodes({
																imdb: diziid,
																Season: 12
															}, function (err, data12) {
																if (err) {
																	console.error(err);
																	return;
																}
																if (data12.response == "False") {
																	sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
																	res.render('dizileriminfo', {
																		username: req.session.user,
																		serie: serie,
																		seasons: sezonSayisi
																	});
																	return;
																}
																omdb.getEpisodes({
																	imdb: diziid,
																	Season: 13
																}, function (err, data13) {
																	if (err) {
																		console.error(err);
																		return;
																	}
																	if (data13.response == "False") {
																		sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
																		res.render('dizileriminfo', {
																			username: req.session.user,
																			serie: serie,
																			seasons: sezonSayisi
																		});
																		return;
																	}
																	omdb.getEpisodes({
																		imdb: diziid,
																		Season: 14
																	}, function (err, data14) {
																		if (err) {
																			console.error(err);
																			return;
																		}
																		if (data14.response == "False") {
																			sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
																			res.render('dizileriminfo', {
																				username: req.session.user,
																				serie: serie,
																				seasons: sezonSayisi
																			});
																			return;
																		}
																		omdb.getEpisodes({
																			imdb: diziid,
																			Season: 15
																		}, function (err, data15) {
																			if (err) {
																				console.error(err);
																				return;
																			}
																			if (data15.response == "False") {
																				sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
																				res.render('dizileriminfo', {
																					username: req.session.user,
																					serie: serie,
																					seasons: sezonSayisi
																				});
																				return;
																			}
																			omdb.getEpisodes({
																				imdb: diziid,
																				Season: 16
																			}, function (err, data16) {
																				if (err) {
																					console.error(err);
																					return;
																				}
																				if (data16.response == "False") {
																					sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
																					res.render('dizileriminfo', {
																						username: req.session.user,
																						serie: serie,
																						seasons: sezonSayisi
																					});
																					return;
																				}
																				omdb.getEpisodes({
																					imdb: diziid,
																					Season: 17
																				}, function (err, data17) {
																					if (err) {
																						console.error(err);
																						return;
																					}
																					if (data17.response == "False") {
																						sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
																						res.render('dizileriminfo', {
																							username: req.session.user,
																							serie: serie,
																							seasons: sezonSayisi
																						});
																						return;
																					}
																					omdb.getEpisodes({
																						imdb: diziid,
																						Season: 18
																					}, function (err, data18) {
																						if (err) {
																							console.error(err);
																							return;
																						}
																						if (data18.response == "False") {
																							sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
																							res.render('dizileriminfo', {
																								username: req.session.user,
																								serie: serie,
																								seasons: sezonSayisi
																							});
																							return;
																						}
																						omdb.getEpisodes({
																							imdb: diziid,
																							Season: 19
																						}, function (err, data19) {
																							if (err) {
																								console.error(err);
																								return;
																							}
																							if (data19.response == "False") {
																								sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
																								res.render('dizileriminfo', {
																									username: req.session.user,
																									serie: serie,
																									seasons: sezonSayisi
																								});
																								return;
																							}
																							omdb.getEpisodes({
																								imdb: diziid,
																								Season: 20
																							}, function (err, data20) {
																								if (err) {
																									console.error(err);
																									return;
																								}
																								if (data20.response == "False") {
																									sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
																									res.render('dizileriminfo', {
																										username: req.session.user,
																										serie: serie,
																										seasons: sezonSayisi
																									});
																									return;
																								}
																								omdb.getEpisodes({
																									imdb: diziid,
																									Season: 21
																								}, function (err, data21) {
																									if (err) {
																										console.error(err);
																										return;
																									}
																									if (data21.response == "False") {
																										sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
																										res.render('dizileriminfo', {
																											username: req.session.user,
																											serie: serie,
																											seasons: sezonSayisi
																										});
																										return;
																									}
																									omdb.getEpisodes({
																										imdb: diziid,
																										Season: 22
																									}, function (err, data22) {
																										if (err) {
																											console.error(err);
																											return;
																										}
																										if (data22.response == "False") {
																											sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
																											res.render('dizileriminfo', {
																												username: req.session.user,
																												serie: serie,
																												seasons: sezonSayisi
																											});
																											return;
																										}
																										omdb.getEpisodes({
																											imdb: diziid,
																											Season: 23
																										}, function (err, data23) {
																											if (err) {
																												console.error(err);
																												return;
																											}
																											if (data23.response == "False") {
																												sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
																												res.render('dizileriminfo', {
																													username: req.session.user,
																													serie: serie,
																													seasons: sezonSayisi
																												});
																												return;
																											}
																											omdb.getEpisodes({
																												imdb: diziid,
																												Season: 24
																											}, function (err, data24) {
																												if (err) {
																													console.error(err);
																													return;
																												}
																												if (data24.response == "False") {
																													sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
																													res.render('dizileriminfo', {
																														username: req.session.user,
																														serie: serie,
																														seasons: sezonSayisi
																													});
																													return;
																												}
																												omdb.getEpisodes({
																													imdb: diziid,
																													Season: 25
																												}, function (err, data25) {
																													if (err) {
																														console.error(err);
																														return;
																													}
																													if (data25.response == "False") {
																														sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
																														res.render('dizileriminfo', {
																															username: req.session.user,
																															serie: serie,
																															seasons: sezonSayisi
																														});
																														return;
																													}
																													omdb.getEpisodes({
																														imdb: diziid,
																														Season: 26
																													}, function (err, data26) {
																														if (err) {
																															console.error(err);
																															return;
																														}
																														if (data26.response == "False") {
																															sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
																															res.render('dizileriminfo', {
																																username: req.session.user,
																																serie: serie,
																																seasons: sezonSayisi
																															});
																															return;
																														}
																														omdb.getEpisodes({
																															imdb: diziid,
																															Season: 27
																														}, function (err, data27) {
																															if (err) {
																																console.error(err);
																																return;
																															}
																															if (data27.response == "False") {
																																sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
																																res.render('dizileriminfo', {
																																	username: req.session.user,
																																	serie: serie,
																																	seasons: sezonSayisi
																																});
																																return;
																															}
																															omdb.getEpisodes({
																																imdb: diziid,
																																Season: 28
																															}, function (err, data28) {
																																if (err) {
																																	console.error(err);
																																	return;
																																}
																																if (data28.response == "False") {
																																	sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
																																	res.render('dizileriminfo', {
																																		username: req.session.user,
																																		serie: serie,
																																		seasons: sezonSayisi
																																	});
																																	return;
																																}
																																omdb.getEpisodes({
																																	imdb: diziid,
																																	Season: 29
																																}, function (err, data29) {
																																	if (err) {
																																		console.error(err);
																																		return;
																																	}
																																	if (data29.response == "False") {
																																		sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];
																																		res.render('dizileriminfo', {
																																			username: req.session.user,
																																			serie: serie,
																																			seasons: sezonSayisi
																																		});
																																		return;
																																	}
																																	omdb.getEpisodes({
																																		imdb: diziid,
																																		Season: 30
																																	}, function (err, data30) {
																																		if (err) {
																																			console.error(err);
																																			return;
																																		}
																																		if (data30.response == "False") {
																																			sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
																																			res.render('dizileriminfo', {
																																				username: req.session.user,
																																				serie: serie,
																																				seasons: sezonSayisi
																																			});
																																			return;
																																		}
																																		omdb.getEpisodes({
																																			imdb: diziid,
																																			Season: 31
																																		}, function (err, data31) {
																																			if (err) {
																																				console.error(err);
																																				return;
																																			}
																																			if (data31.response == "False") {
																																				sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
																																				res.render('dizileriminfo', {
																																					username: req.session.user,
																																					serie: serie,
																																					seasons: sezonSayisi
																																				});
																																				return;
																																			}
																																			omdb.getEpisodes({
																																				imdb: diziid,
																																				Season: 32
																																			}, function (err, data32) {
																																				if (err) {
																																					console.error(err);
																																					return;
																																				}
																																				if (data32.response == "False") {
																																					sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
																																					res.render('dizileriminfo', {
																																						username: req.session.user,
																																						serie: serie,
																																						seasons: sezonSayisi
																																					});
																																					return;
																																				}
																																				omdb.getEpisodes({
																																					imdb: diziid,
																																					Season: 33
																																				}, function (err, data33) {
																																					if (err) {
																																						console.error(err);
																																						return;
																																					}
																																					if (data33.response == "False") {
																																						sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
																																						res.render('dizileriminfo', {
																																							username: req.session.user,
																																							serie: serie,
																																							seasons: sezonSayisi
																																						});
																																						return;
																																					}
																																					omdb.getEpisodes({
																																						imdb: diziid,
																																						Season: 34
																																					}, function (err, data34) {
																																						if (err) {
																																							console.error(err);
																																							return;
																																						}
																																						if (data34.response == "False") {
																																							sezonSayisi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33];
																																							res.render('dizileriminfo', {
																																								username: req.session.user,
																																								serie: serie,
																																								seasons: sezonSayisi
																																							});
																																							return;
																																						}
																																					});
																																				});
																																			});
																																		});
																																	});
																																});
																															});
																														});
																													});
																												});
																											});
																										});
																									});
																								});
																							});
																						});
																					});
																				});
																			});
																		});
																	});
																});
															});
														});
													});
												});
											});
										});
									});
								});
							});
						});
					});
				});
			});
		}
			else{
				res.redirect('/');
			}
	});
	}
	else
		res.redirect('/');
});

app.post('/kaydet/:diziid/:sezonid', function(req,res){
	var post = req.body,
		diziid = req.params.diziid,
		sezonid = req.params.sezonid;
	if(post.episode == null){
		post.episode = [];
	}

	Episodesdb.update({'username': req.session.user },{ $pull: { series:{serie_id:diziid , season_number:sezonid}}},function(err,data){
		if(err){}
		Episodesdb.findOne({'username': req.session.user}, function(err, Episodedb){
			if (err) {
				console.error(err);
				return;
			}
			Episodedb.series.addToSet({ serie_id: diziid,season_number: sezonid, watched_episodes : post.episode });
			Episodedb.save(function(err) {
				if (err) throw err;
			});
			res.redirect('/dizilerim/' + diziid);
		});
	});

});
app.get('/dizilerim/bolumler/:diziid/:sezonid', function(req,res){
	if(req.session.user) {
		var diziid = req.params.diziid;
		var hepsini_izledim = 0;
		Series.findOne({"username": req.session.user, "series":{"$elemMatch":{"serie_id": diziid}}},{"series.$":1}, function(err,data) {
			if (err) throw err;
			if (data) {
				var diziid = req.params.diziid,
					sezonid = req.params.sezonid;
				omdb.get({imdb: diziid}, function (err, serie) {
					if (err) {
						console.error(err);
						return;
					}
					omdb.getEpisodes({imdb: diziid, Season: sezonid}, function (err, data) {
						Episodesdb.findOne({
							"username": req.session.user,
							"series": {"$elemMatch": {"serie_id": diziid, "season_number": sezonid}}
						}, {"series.$": 1}, function (err, Episodedb) {
							if (err) throw err;
							var send_watched_episodes, hata = "";
							if (Episodedb) {
								send_watched_episodes = Episodedb.series[0].watched_episodes;
								if(!data.episodes){
									hata = sezonid + " numarali sezon bulunamadi.";
								}
								res.render('bolumler', {
									username: req.session.user,
									serie: serie,
									season: data.season,
									episodes: data.episodes,
									watched_episodes: send_watched_episodes,
									hata: hata,
									hepsini_izledim: hepsini_izledim
								});
							}
							else {
								Episodesdb.findOne({
									"username": req.session.user,
									"series": {"$elemMatch": {"serie_id": diziid, "season_number": 0}}
								}, {"series.$": 1}, function (err, Episodedb) {
									if(Episodedb){
										if(Episodedb.series[0].watched_episodes == 1){
											hepsini_izledim = 1;
										}
										else {
											send_watched_episodes = [];
										}
										if(!data.episodes){
											hata = sezonid + " numarali sezon bulunamadi.";
										}
										res.render('bolumler', {
											username: req.session.user,
											serie: serie,
											season: data.season,
											episodes: data.episodes,
											watched_episodes: send_watched_episodes,
											hata: hata,
											hepsini_izledim: hepsini_izledim
										});
									}
									else {
										send_watched_episodes = [];
										if(!data.episodes){
											hata = sezonid + " numarali sezon bulunamadi.";
										}
										res.render('bolumler', {
											username: req.session.user,
											serie: serie,
											season: data.season,
											episodes: data.episodes,
											watched_episodes: send_watched_episodes,
											hata: hata,
											hepsini_izledim: hepsini_izledim
										});
									}
								});
							}

						});
					});
				});
				/**/
			}
			else{
				res.redirect('/');
			}
		});
	}
	else
		res.redirect('/');
});
app.post('/diziekle/:diziid', function(req,res){
	if(req.session.user){
		var diziid = req.params.diziid;
		Series.findOne({'username' : req.session.user}, function(err, Serie){
			if(err) throw err;
			omdb.get({imdb: diziid}, function (err, serie) {
				if (err) {
					console.error(err);
					return;
				}
				Serie.series.addToSet({ serie_id: diziid, serie_name: serie.title });
				Serie.save(function(err) {
					if (err) throw err;
					Episodesdb.update({'username': req.session.user },{ $pull: { series:{serie_id:diziid , season_number:0}}},function(err,data){
						if(err){}
						Episodesdb.findOne({'username': req.session.user}, function(err, Episodedb){
							if (err) {
								console.error(err);
								return;
							}
							Episodedb.series.addToSet({ serie_id: diziid,season_number: 0, watched_episodes : 0 });
							Episodedb.save(function(err) {
								if (err) throw err;
							});
						});
					});
					res.redirect('/');

				});
			});
		});
	}
	else
		res.redirect('/');
});

app.get('/kayitol', function(req,res){
	if(!req.session.user){
		res.render('kayitol');
	}
	else{
		res.redirect('/');
	}
});

app.post('/dizicikar/:diziid', function(req, res){
	if(req.session.user){
		var diziid = req.params.diziid;
		Episodesdb.update({'username': req.session.user },{ $pull: { series:{serie_id:diziid }}},function(err,data){
			if(err) {console.log('error1'); return;}
			Series.update({'username': req.session.user },{$pull: {series:{serie_id:diziid}}}, function(err,data){
				if(err) {console.log('error1'); return;}
				res.redirect('main');
			});
		});
	}
	else{
		res.redirect('/');
	}
});

app.post('/hepsiniIzledim/:diziid/:seasons', function(req,res){
	if(req.session.user){
		var diziid = req.params.diziid;
		var sezonSayisi = ((req.params.seasons).split(',')).length;
		Episodesdb.update({'username': req.session.user },{ $pull: { series:{serie_id:diziid}}},function(err,data){
			if(err){}
			Episodesdb.findOne({'username': req.session.user}, function(err, Episodedb){
				if (err) {
					console.error(err);
					return;
				}
				Episodedb.series.addToSet({ serie_id: diziid,season_number: 0, watched_episodes : 1 });
				Episodedb.save(function(err) {
					if (err) throw err;
					res.redirect('/dizilerim/' + diziid);
				});
			});
		});
	}
	else{
		res.redirect('/');
	}
});

app.all('*', function(req, res){
	res.redirect('/');
});

console.log('Working.');
