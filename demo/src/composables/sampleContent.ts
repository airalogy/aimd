export const SAMPLE_AIMD = `# 研究协议示例

## 变量定义

请输入样本名称：{{var|sample_name: str}}

温度设定：{{var|temperature: float = 25.0}}

浓度参数：{{var|concentration: float = 1.0, title = "浓度 (M)", unit = "mol/L"}}

是否激活：{{var|is_active: bool = true}}

## 变量表

{{var_table|samples, subvars=[sample_id, concentration, volume]}}

## 实验步骤

{{step|sample_preparation}}
准备样本，确认样本名称 {{ref_var|sample_name}}。

{{step|data_analysis}}
分析数据，检查温度 {{ref_var|temperature}}。

## 质量检查

{{check|quality_control}}
{{check|safety_verification}}

## 引用

参考步骤：{{ref_step|sample_preparation}}

## Markdown 特性

**粗体** *斜体* ~~删除线~~

- 列表项 1
- 列表项 2

| 列 A | 列 B | 列 C |
|------|------|------|
| 1    | 2    | 3    |

> 引用块内容

行内公式 $E = mc^2$

$$
\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\cdots + x_n
$$
`
