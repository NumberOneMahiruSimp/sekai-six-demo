import test from 'node:test';
import assert from 'node:assert/strict';
import {laneGeometry, noteProgress} from '../renderer.js';

test('approach projection preserves spawn and judgment time at every note speed', () => {
  for(const mode of ['perspective','flat'])for(const travel of [.7,1.8,3]) {
    assert.ok(Math.abs(noteProgress(10,10-travel,travel,mode))<1e-12);
    assert.equal(noteProgress(10,10,travel,mode),1);
    let last=-Infinity;
    for(let frame=0;frame<=100;frame++) {
      const p=noteProgress(10,10-travel+travel*frame/100,travel,mode);
      assert.ok(Number.isFinite(p)&&p>last,'notes must approach without reversing or jumping');
      last=p;
    }
  }
});

test('perspective gains speed toward the line and straight mode remains linear', () => {
  const middle=noteProgress(1,.5,1), near=noteProgress(1,.9,1), end=noteProgress(1,1,1);
  assert.ok(end-near>noteProgress(1,.1,1)-noteProgress(1,0,1));
  assert.ok(middle<.5);
  assert.equal(noteProgress(1,.5,1,'flat'),.5);
});

test('rendered hit targets and pointer lanes agree across monitor shapes', () => {
  for(const [width,height] of [[1920,995],[1366,683],[2560,995],[390,776],[844,322]]) {
    for(const mode of ['perspective','flat']) {
      const geometry=laneGeometry(width,height,mode);
      assert.ok(geometry.bottom<=width&&geometry.bottom>0);
      assert.ok(geometry.topY<geometry.bottomY&&geometry.bottomY<height);
      for(let lane=0;lane<6;lane++) {
        const [x,y]=geometry.point(lane+.5,1);
        assert.equal(geometry.laneAt(x),lane);
        assert.equal(y,geometry.bottomY);
      }
      assert.equal(geometry.scaleAt(1),1);
    }
  }
});
