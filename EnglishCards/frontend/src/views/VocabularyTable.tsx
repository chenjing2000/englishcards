import { Fragment } from 'react';
import { senseSourceId, type Project } from '../models/project';
import type { useEditorViewModel } from '../viewmodels/useEditorViewModel';
import EntryHeadInput from './EntryHeadInput';
import AutoSizeTextarea from './AutoSizeTextarea';

type Props = {
  viewModel: ReturnType<typeof useEditorViewModel>;
  registerInput: (id: string, input: HTMLInputElement | HTMLTextAreaElement | null) => void;
};

export default function VocabularyTable({ viewModel: vm, registerInput }: Props) {
  const { project, selectedVocabulary } = vm;
  function editor(entry: Project['vocabulary'][number], index: number, property: 'word' | 'ipa', label: string) {
    if (property === 'word') {
      return <EntryHeadInput
        label={`${label} ${index + 1}`}
        value={entry.word}
        commit={value => vm.commitHead('vocabulary', entry.id, value)}
        inputRef={input => registerInput(`vocabulary:${entry.id}:word`, input)}
      />;
    }
    return <input
      type="text"
      aria-label={`${label} ${index + 1}`}
      value={entry[property] ?? ''}
      ref={input => registerInput(`vocabulary:${entry.id}:${property}`, input)}
      onChange={event => vm.setEntryField('vocabulary', entry.id, property, event.target.value)}
    />;
  }

  return <section className="vocabulary-editor">
    {project.vocabulary.map((entry, index) => <section
      className={`edit-entry vocabulary-entry${entry.id === selectedVocabulary?.id ? ' selected' : ''}`}
      key={entry.id}
      onClick={() => vm.selectVocabulary(entry.id)}
      onFocus={() => vm.selectVocabulary(entry.id)}
    >
      <div className="entry-toolbar"><b>词汇 {index + 1}</b></div>
      <table className="expression-table vocabulary-table" aria-label={`词汇 ${index + 1}`}>
        <tbody>
          <tr>
            <th scope="row">词汇</th>
            <td>
              <div className="entry-value">
                <div className="entry-input">{editor(entry, index, 'word', '词头')}</div>
                <button className="sense-button" title="添加义项" aria-label={`为词汇 ${index + 1} 添加义项`}
                  disabled={entry.senses.length >= 2000}
                  onClick={() => vm.addSense('vocabulary', entry.id)}>+</button>
              </div>
            </td>
          </tr>
          <tr>
            <th scope="row">音标</th>
            <td>{editor(entry, index, 'ipa', '音标')}</td>
          </tr>
          {entry.senses.map((sense, senseIndex) => <Fragment key={senseIndex}>
            <tr>
              <th scope="row">含义{senseIndex > 0 ? ` ${senseIndex + 1}` : ''}</th>
              <td>
                <div className="entry-value">
                  <div className="entry-input">
                    <EntryHeadInput
                      multiline
                      label={`含义 ${index + 1}${senseIndex ? ` 义项 ${senseIndex + 1}` : ''}`}
                      value={sense.pos ? `${sense.pos} ${sense.meaning}` : sense.meaning}
                      inputRef={input => {
                        for (const property of ['pos', 'meaning']) {
                          registerInput(`vocabulary:${senseSourceId(entry.id, senseIndex, property)}`, input);
                        }
                      }}
                      commit={value => vm.setVocabularyMeaning(entry.id, senseIndex, value)}
                    />
                  </div>
                  <button className="sense-button" title="删除义项"
                    aria-label={`删除词汇 ${index + 1} 义项 ${senseIndex + 1}`}
                    disabled={entry.senses.length <= 1}
                    onClick={() => vm.removeSense('vocabulary', entry.id, senseIndex)}>−</button>
                </div>
              </td>
            </tr>
            {(['example', 'exampleTranslation'] as const).map(property => <tr key={property}>
              <th scope="row">{property === 'example' ? '例句' : '翻译'}{senseIndex > 0 ? ` ${senseIndex + 1}` : ''}</th>
              <td>
                <AutoSizeTextarea
                  label={`词汇${property === 'example' ? '例句' : '翻译'} ${index + 1} 义项 ${senseIndex + 1}`}
                  value={sense[property]}
                  inputRef={input => registerInput(`vocabulary:${senseSourceId(entry.id, senseIndex, property)}`, input)}
                  onChange={value => vm.setSenseField('vocabulary', entry.id, senseIndex, property, value)}
                />
              </td>
            </tr>)}
          </Fragment>)}
        </tbody>
      </table>
    </section>)}
    {!project.vocabulary.length && <p className="hint">暂无词汇，点击下方加号添加。</p>}
  </section>;
}

type VocabularyActionIconName = 'up' | 'down' | 'add' | 'delete';

function VocabularyActionIcon({ name }: { name: VocabularyActionIconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24">
    {name === 'up' && <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />}
    {name === 'down' && <path d="M12 5v14m-6.5-6.5L12 19l6.5-6.5" />}
    {name === 'add' && <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8m-4-4h8" /></>}
    {name === 'delete' && <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" /><path d="M10 11v5m4-5v5" /></>}
  </svg>;
}

export function VocabularyActions({ viewModel: vm, focusField }: {
  viewModel: Props['viewModel'];
  focusField: (id: string) => void;
}) {
  const { project, selectedVocabulary, selectedVocabularyIndex } = vm;
  return <div className="vocabulary-actions" role="group" aria-label="词汇行操作">
    <button className="action-move" aria-label="上移选中词汇" title="上移选中词汇"
      disabled={selectedVocabularyIndex <= 0} onClick={() => vm.moveSelectedVocabulary(-1)}>
      <VocabularyActionIcon name="up" />
    </button>
    <button className="action-move" aria-label="下移选中词汇" title="下移选中词汇"
      disabled={selectedVocabularyIndex < 0 || selectedVocabularyIndex === project.vocabulary.length - 1}
      onClick={() => vm.moveSelectedVocabulary(1)}>
      <VocabularyActionIcon name="down" />
    </button>
    <button className="action-add" aria-label="在选中词汇下方添加空白行" title="添加新空白词汇"
      onClick={() => focusField(`vocabulary:${vm.insertVocabularyBelow()}:word`)}>
      <VocabularyActionIcon name="add" />
    </button>
    <button className="action-delete" aria-label="删除选中词汇" title="删除选中词汇"
      disabled={!selectedVocabulary} onClick={vm.deleteSelectedVocabulary}>
      <VocabularyActionIcon name="delete" />
    </button>
  </div>;
}
