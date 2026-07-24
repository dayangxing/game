<script>
  let { modelConfig, isDesktop, onSave, onClear, onClose } = $props();

  let baseUrl = $state('');
  let apiKey = $state('');
  let chatModel = $state('qwen3.7-plus');
  let statusMessage = $state('');
  let initializedFromConfig = $state(false);

  $effect(() => {
    if (initializedFromConfig) return;
    baseUrl = modelConfig?.baseUrl ?? '';
    chatModel = modelConfig?.chatModel ?? 'qwen3.7-plus';
    statusMessage = modelConfig?.configured
      ? '已配置 API Key；API Key 留空会保留当前 Key。'
      : '首次进入建议先配置 API Key，也可以暂时跳过。';
    initializedFromConfig = true;
  });

  function handleSave() {
    const config = { baseUrl, chatModel };
    if (apiKey.trim()) config.apiKey = apiKey.trim();
    onSave(config);
  }

  function handleClear() {
    onClear();
    baseUrl = '';
    apiKey = '';
    chatModel = 'qwen3.7-plus';
    statusMessage = '已清除配置';
  }
</script>

<div class="model-config-overlay" role="dialog" aria-modal="true">
  <section class="model-config-dialog">
    <div class="model-config-kicker">云箓设置</div>
    <h2>连接你的模型</h2>
    <p class="model-config-intro">填写一个兼容 OpenAI Chat Completions 的服务地址，保存后会立即用于后续剧情生成。</p>

    <div class="model-config-fields">
      <label class="model-config-field">
        <span>API 地址</span>
        <input type="url" autocomplete="url" placeholder="https://example.com/v1" bind:value={baseUrl} />
      </label>
      <label class="model-config-field">
        <span>API Key</span>
        <input type="password" autocomplete="new-password" placeholder="留空保持当前 Key" bind:value={apiKey} />
      </label>
      <label class="model-config-field">
        <span>主模型</span>
        <input type="text" autocomplete="off" placeholder="qwen3.7-plus" bind:value={chatModel} />
      </label>
    </div>

    {#if statusMessage}
      <p class="model-config-status">{statusMessage}</p>
    {/if}

    <div class="model-config-actions">
      <button type="button" onclick={onClose}>暂不配置</button>
      <button type="button" onclick={handleClear}>清除配置</button>
      <button type="button" onclick={handleSave}>保存并应用</button>
    </div>
  </section>
</div>
