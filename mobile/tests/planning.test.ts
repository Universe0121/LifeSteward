import assert from 'node:assert/strict';
import test from 'node:test';
import { classify_chat_action, extract_task_name, is_plan_request, is_task_only_request, normalize_plan_items, requested_date_key } from '../src/domain/planning';
import { add_days, local_date_key } from '../src/utils/date';

test('distinguishes a date-only task from a minute-level plan', () => {
  assert.equal(is_task_only_request('明天添加任务：整理课堂笔记'), true);
  assert.equal(is_plan_request('明天安排学习计划'), true);
  assert.equal(extract_task_name('明天添加任务：整理课堂笔记'), '整理课堂笔记');
});

test('maps natural-language dates and validates generated plan items', () => {
  const today = local_date_key();
  assert.equal(requested_date_key('明天安排复习'), add_days(today, 1));
  assert.deepEqual(normalize_plan_items([{ task_name: '复习', start_time: '09:00', duration_minutes: 60, difficulty: 0.4 }, { task_name: '', start_time: 'bad', duration_minutes: 0 }]), [{ task_name: '复习', start_time: '09:00', duration_minutes: 60, difficulty: 0.4 }]);
});

test('recognizes natural task language and keeps recorded history out of task lists', () => {
  assert.equal(is_task_only_request('把跑步加入今天的任务'), true);
  assert.equal(extract_task_name('把跑步加入今天的任务'), '跑步');
  assert.equal(is_task_only_request('明天整理课堂笔记'), true);
  assert.equal(is_task_only_request('我今天学习数学2小时'), false);
  assert.equal(classify_chat_action('把跑步加入今天的任务', 'record_event'), 'task');
  assert.equal(classify_chat_action('明天安排学习计划', 'planning', [{ task_name: '复习', start_time: '09:00', duration_minutes: 30, difficulty: 0.4 }]), 'plan');
});
