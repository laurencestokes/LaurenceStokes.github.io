---
layout: page
title: CodeFighter
---

CodeFighter is a full-stack Javascript web application using technologies such as Node.js, MongoDB, Express, and Bootstrap that I developed as part of my undergraduate project whilst at at the [University of Birmingham, UK](https://www.cs.bham.ac.uk/){:target="_blank"}. The application was designed to function as a learning tool where students could code against their peers, with the aim of submitting a correct solution to a given challenge faster than their opponent. Students were assigned ratings (using an ELO system) based on their performances, so they would be matched against appropriately skilled opponents.

On reflection (after a few years exposure to the "professional" software development) the code I wrote in making CodeFighter is horrible and full of [smells](https://en.wikipedia.org/wiki/Code_smell){:target="_blank"}. When I started the project I didn't wholly appreciate (nor understand!) the purpose and power of Node's event loop and I wrote code that was the antithesis to it. Despite all of this, it *did work* and did have some cool features, including:

* Single and Multi-player code challenges with user profile badge rewards for completion,
* Robust Matchmaking for multi-player challenges that suitably matches players based on their relative skill levels,
* An easy to use syntax highlighter that matches the features and performance of native editors such as Sublime, Vim and TextMate for writing code,
* Robust error-checking for syntax errors and lint-like behaviors in user-written code,
* A secure Local Authentication strategy, as well as Authentication strategies through social platforms such as Facebook and Twitter.

If anyone wants to visit the application and have a go, it's (as of this writing) up and running on a free dyno instance provided by [Heroku](https://www.heroku.com/){:target="_blank"} and using a (free) MongoDB "Database as a Service" instance provided by [Mlab](https://mlab.com/){:target="_blank"} and can be found [here](http://codefighter.herokuapp.com/){:target="_blank"}.

*(Note: I'm pretty sure I "borrowed" several of the images on the website from Google. I am in no way monetizing the application - it was simply my undergraduate project at University. Please don't sue me. If you are the owner of any of the images and want them removed, just ask!).*
