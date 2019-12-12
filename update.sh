#!/bin/bash

cd $HOME/blog
git submodule update --rebase --remote & git add * & git add .* & git commit -m "update" -a & git push -u origin master
