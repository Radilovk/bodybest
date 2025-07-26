/** @jest-environment jsdom */
import { jest } from '@jest/globals'

let loadEmailSettings, saveEmailSettings
let mockLoad, mockSave

beforeEach(async () => {
  jest.resetModules()
  document.body.innerHTML = `
    <form id="emailSettingsForm"></form>
    <input id="welcomeEmailSubject">
    <textarea id="welcomeEmailBody"></textarea>
    <input id="questionnaireEmailSubject">
    <textarea id="questionnaireEmailBody"></textarea>
    <input id="analysisEmailSubject">
    <textarea id="analysisEmailBody"></textarea>
    <div id="welcomeEmailPreview"></div>
    <div id="questionnaireEmailPreview"></div>
    <div id="analysisEmailPreview"></div>
    <input id="sendQuestionnaireEmail" type="checkbox">
    <input id="sendWelcomeEmail" type="checkbox">
    <input id="sendAnalysisEmail" type="checkbox">
    <button id="showStats"></button>
  `
  mockLoad = jest.fn().mockResolvedValue({
    welcome_email_subject: 's1',
    welcome_email_body: '<b>w</b>',
    questionnaire_email_subject: 's2',
    questionnaire_email_body: '<i>q</i>',
    analysis_email_subject: 's3',
    analysis_email_body: '<u>a</u>',
    send_questionnaire_email: '0',
    send_welcome_email: '1',
    send_analysis_email: '0'
  })
  mockSave = jest.fn().mockResolvedValue({})
  jest.unstable_mockModule('../adminConfig.js', () => ({
    loadConfig: mockLoad,
    saveConfig: mockSave
  }))
  ;({ loadEmailSettings, saveEmailSettings } = await import('../admin.js'))
})

afterEach(() => {
  mockLoad.mockReset()
  mockSave.mockReset()
})

test('loadEmailSettings populates form and flags', async () => {
  await loadEmailSettings()
  expect(mockLoad).toHaveBeenCalledWith([
    'welcome_email_subject',
    'welcome_email_body',
    'questionnaire_email_subject',
    'questionnaire_email_body',
    'analysis_email_subject',
    'analysis_email_body',
    'send_questionnaire_email',
    'send_welcome_email',
    'send_analysis_email'
  ])
  expect(document.getElementById('sendWelcomeEmail').checked).toBe(true)
  expect(document.getElementById('sendAnalysisEmail').checked).toBe(false)
})

test('saveEmailSettings sends updated flags', async () => {
  document.getElementById('sendQuestionnaireEmail').checked = true
  document.getElementById('sendWelcomeEmail').checked = false
  document.getElementById('sendAnalysisEmail').checked = true
  await saveEmailSettings()
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
    send_questionnaire_email: '1',
    send_welcome_email: '0',
    send_analysis_email: '1'
  }))
})
