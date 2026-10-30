export const WORKFLOWS = {
  'premiere-pro': [
    { name: 'Review a sequence', tools: ['get_sequence_settings', 'get_timeline', 'list_markers'] },
    {
      name: 'Prepare an export range',
      tools: ['set_sequence_range', 'set_playhead', 'export_sequence']
    }
  ],
  photoshop: [
    {
      name: 'Edit a text design',
      tools: ['get_document_info', 'list_layers', 'set_text_layer', 'export_image']
    },
    {
      name: 'Create a variation',
      tools: ['duplicate_document', 'duplicate_layer', 'translate_layer', 'save_as_psd']
    }
  ],
  'media-encoder': [
    {
      name: 'Inspect and queue media',
      tools: ['inspect_source', 'add_to_queue', 'start_batch', 'get_batch_status']
    },
    {
      name: 'Assemble a stitched output',
      tools: ['stitch_files', 'start_batch', 'get_batch_status']
    }
  ],
  illustrator: [
    {
      name: 'Build vector artwork',
      tools: ['list_artboards', 'activate_artboard', 'add_ellipse', 'add_text', 'save_as_ai']
    },
    { name: 'Place and review artwork', tools: ['place_image', 'get_selection', 'save_as_pdf'] }
  ],
  indesign: [
    {
      name: 'Review publication assets',
      tools: ['get_document_info', 'list_links', 'update_link']
    },
    {
      name: 'Deliver a layout',
      tools: ['list_pages', 'list_text_frames', 'export_pdf', 'export_idml']
    }
  ],
  'after-effects': [
    {
      name: 'Animate a layer',
      tools: ['get_composition', 'list_layers', 'set_transform_keyframe', 'set_work_area']
    },
    {
      name: 'Prepare a render',
      tools: [
        'add_composition_marker',
        'add_to_render_queue',
        'get_render_templates',
        'render_queue'
      ]
    }
  ],
  audition: [
    {
      name: 'Navigate a waveform',
      tools: ['get_active_document', 'set_playhead', 'seek_playhead']
    },
    {
      name: 'Discover and run commands',
      tools: ['list_commands', 'get_api_member', 'is_command_enabled', 'invoke_commands']
    }
  ]
};

export function workflowGuide(app, title) {
  const recipes = WORKFLOWS[app]
    .map(
      (recipe) =>
        `## ${recipe.name}\n\n${recipe.tools.map((name, i) => `${i + 1}. \`${name}\``).join('\n')}`
    )
    .join('\n\n');
  return `# ${title} workflow guide\n\nStart with connection_status and inspect the active document or project before editing. Supply tool arguments from the catalog; the sequences below are recipes, not automatic execution.\n\n${recipes}\n\nUse explicit output paths and overwrite choices. Queue acceptance is not render completion. A dispatched timeout may leave an operation running: inspect the host before retrying. Native host compatibility remains unverified.\n`;
}
