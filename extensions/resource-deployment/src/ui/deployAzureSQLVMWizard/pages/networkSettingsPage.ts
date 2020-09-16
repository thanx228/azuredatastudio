/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';
import * as constants from '../constants';
import { BasePage } from './basePage';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();



export class NetworkSettingsPage extends BasePage {

	// virtual network components
	private _newVirtualNetworkCheckbox!: azdata.CheckBoxComponent;
	private _virtualNetworkFlexContainer !: azdata.FlexContainer;
	private _virtualNetworkDropdown!: azdata.DropDownComponent;
	private _newVirtualNetworkText!: azdata.InputBoxComponent;

	// subnet network components
	private _newSubnetCheckbox!: azdata.CheckBoxComponent;
	private _subnetFlexContainer !: azdata.FlexContainer;
	private _subnetDropdown!: azdata.DropDownComponent;
	private _newsubnetText!: azdata.InputBoxComponent;

	// public ip components
	private _newPublicIpCheckbox!: azdata.CheckBoxComponent;
	private _publicIpFlexContainer !: azdata.FlexContainer;
	private _publicIpDropdown!: azdata.DropDownComponent;
	private _publicIpNetworkText!: azdata.InputBoxComponent;

	// checkbox for RDP
	private _vmRDPAllowCheckbox!: azdata.CheckBoxComponent;

	private _form!: azdata.FormContainer;

	constructor(wizard: DeployAzureSQLVMWizard) {
		super(
			constants.NetworkSettingsPageTitle,
			constants.NetworkSettingsPageDescription,
			wizard
		);
	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			await Promise.all([
				this.createVirtualNetworkDropdown(view),
				this.createSubnetDropdown(view),
				this.createPublicIPDropdown(view),
				this.createVmRDPAllowCheckbox(view)
			]);



			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							component: this.wizard.createFormRowComponent(view, constants.VirtualNetworkDropdownLabel, '', this._virtualNetworkFlexContainer, true)
						},
						{
							component: this.wizard.createFormRowComponent(view, constants.SubnetDropdownLabel, '', this._subnetFlexContainer, true)
						},
						{
							component: this.wizard.createFormRowComponent(view, constants.PublicIPDropdownLabel, '', this._publicIpFlexContainer, true)
						},
						{
							component: this._vmRDPAllowCheckbox
						}
					],
					{
						horizontal: false,
						componentWidth: '100%'
					})
				.withLayout({ width: '100%' })
				.component();

			return view.initializeModel(this._form);
		});
	}

	public async onEnter(): Promise<void> {
		this.populateVirtualNetworkDropdown();
		this.populatePublicIpkDropdown();
		this.liveValidation = false;
		this.wizard.wizardObject.registerNavigationValidator(async (pcInfo) => {
			if (pcInfo.newPage < pcInfo.lastPage) {
				return true;
			}
			this.liveValidation = true;
			let errorMessage = await this.validatePage();

			if (errorMessage !== '') {
				return false;
			}
			return true;
		});
	}

	public onLeave(): void {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	private async createVirtualNetworkDropdown(view: azdata.ModelView) {

		this._newVirtualNetworkCheckbox = view.modelBuilder.checkBox().withProperties(<azdata.CheckBoxProperties>{
			label: constants.NetworkSettingsNewVirtualNetwork,
			checked: false
		}).component();

		this._newVirtualNetworkCheckbox.onChanged((event) => {
			this.toggleNewVirtualNetwork();
		});

		this._virtualNetworkDropdown = view.modelBuilder.dropDown().withProperties({
			width: constants.standardWidth,
			required: true
		}).component();

		this._virtualNetworkDropdown.onValueChanged((value) => {
			this.wizard.model.virtualNetworkName = (this._virtualNetworkDropdown.value as azdata.CategoryValue).name;
			this.populateSubnetDropdown();
		});

		this._newVirtualNetworkText = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			width: constants.standardWidth,
			required: true,
			placeHolder: localize('deployAzureSQLVM.NewVnetPlaceholder', "Enter name for new virtual network")
		}).component();

		this._newVirtualNetworkText.onTextChanged((e) => {
			this.wizard.model.virtualNetworkName = e;
			this.activateRealTimeFormValidation();
		});

		this._virtualNetworkFlexContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withItems(
			[this._virtualNetworkDropdown, this._newVirtualNetworkText, this._newVirtualNetworkCheckbox]
		).component();

	}

	private async populateVirtualNetworkDropdown() {
		this._virtualNetworkDropdown.loading = true;

		let vnets = await this.getVirtualNetworks();
		if (!vnets || vnets.length === 0) {
			vnets = [
				{
					displayName: 'None',
					name: 'None'
				}
			];
			this._virtualNetworkDropdown.updateProperties({
				values: vnets
			});
			this._newVirtualNetworkCheckbox.checked = true;
			this._newVirtualNetworkCheckbox.enabled = false;
			this.toggleNewVirtualNetwork();
		} else {
			this._virtualNetworkDropdown.updateProperties({
				values: vnets
			});
			this._newVirtualNetworkCheckbox.enabled = true;
			this.toggleNewVirtualNetwork();
		}
		this._virtualNetworkDropdown.loading = false;


		await this.populateSubnetDropdown();
	}

	private toggleNewVirtualNetwork() {

		let newVirtualNetwork = this._newVirtualNetworkCheckbox.checked;

		this.wizard.model.newVirtualNetwork = newVirtualNetwork ? 'True' : 'False';

		if (newVirtualNetwork) {

			this.wizard.changeComponentDisplay(this._virtualNetworkDropdown, 'none');
			this.wizard.changeComponentDisplay(this._newVirtualNetworkText, 'block');
			this._newSubnetCheckbox.enabled = false;
			this.wizard.changeComponentDisplay(this._subnetDropdown, 'none');
			this.wizard.changeComponentDisplay(this._newsubnetText, 'block');
			this.wizard.model.virtualNetworkName = this._newVirtualNetworkText.value!;
			this.wizard.model.newSubnet = 'True';
			this.wizard.model.subnetName = this._newsubnetText.value!;

		} else {

			this.wizard.changeComponentDisplay(this._virtualNetworkDropdown, 'block');
			this.wizard.changeComponentDisplay(this._newVirtualNetworkText, 'none');
			this._newSubnetCheckbox.enabled = true;
			this.wizard.changeComponentDisplay(this._subnetDropdown, 'block');
			this.wizard.changeComponentDisplay(this._newsubnetText, 'none');
			this.wizard.model.virtualNetworkName = (this._virtualNetworkDropdown.value as azdata.CategoryValue).name;
			this.wizard.model.newSubnet = this._newSubnetCheckbox.checked! ? 'True' : 'False';
		}
	}

	private async createSubnetDropdown(view: azdata.ModelView) {

		this._newSubnetCheckbox = view.modelBuilder.checkBox().withProperties<azdata.CheckBoxProperties>({
			label: constants.NetworkSettingsNewSubnet,
			checked: false
		}).component();

		this._newSubnetCheckbox.onChanged((value) => {
			this.toggleNewSubnet();
		});


		this._subnetDropdown = view.modelBuilder.dropDown().withProperties(<azdata.DropDownProperties>{
			width: constants.standardWidth,
			required: true
		}).component();

		this._subnetDropdown.onValueChanged((value) => {
			this.wizard.model.subnetName = (this._subnetDropdown.value as azdata.CategoryValue).name;
		});

		this._newsubnetText = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			width: constants.standardWidth,
			required: true,
			placeHolder: localize('deployAzureSQLVM.NewSubnetPlaceholder', "Enter name for new subnet")
		}).component();

		this._newsubnetText.onTextChanged((e) => {
			this.wizard.model.subnetName = e;
			this.activateRealTimeFormValidation();
		});

		this._subnetFlexContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withItems(
			[this._subnetDropdown, this._newsubnetText, this._newSubnetCheckbox]
		).component();

	}


	private async populateSubnetDropdown() {
		this._subnetDropdown.loading = true;

		let subnets = await this.getSubnets();
		if (!subnets || subnets.length === 0) {
			subnets = [{
				displayName: 'None',
				name: 'None'
			}];
			this._subnetDropdown.updateProperties({
				values: subnets
			});
			this._newSubnetCheckbox.checked = true;
			this._newSubnetCheckbox.enabled = false;
			this.toggleNewSubnet();
		} else {
			this._subnetDropdown.updateProperties({
				values: subnets
			});
			this._newSubnetCheckbox.enabled = true;
			this.toggleNewSubnet();
		}

		this._subnetDropdown.loading = false;
	}

	private toggleNewSubnet() {

		let newSubnet = this._newSubnetCheckbox.checked!;

		this.wizard.model.newSubnet = newSubnet ? 'True' : 'False';

		if (newSubnet) {
			this.wizard.changeComponentDisplay(this._subnetDropdown, 'none');
			this.wizard.changeComponentDisplay(this._newsubnetText, 'block');
			this.wizard.model.subnetName = this._newsubnetText.value!;
		} else {
			this.wizard.changeComponentDisplay(this._subnetDropdown, 'block');
			this.wizard.changeComponentDisplay(this._newsubnetText, 'none');
			this.wizard.model.subnetName = (this._subnetDropdown.value as azdata.CategoryValue).name;
		}
	}

	private async createPublicIPDropdown(view: azdata.ModelView) {

		this._newPublicIpCheckbox = view.modelBuilder.checkBox().withProperties(<azdata.CheckBoxProperties>{
			label: constants.NetworkSettingsNewPublicIp,
			checked: false
		}).component();

		this._newPublicIpCheckbox.onChanged((event) => {
			this.toggleNewPublicIp();
		});

		this._publicIpDropdown = view.modelBuilder.dropDown().withProperties({
			required: true,
			width: constants.standardWidth,
		}).component();

		this._publicIpDropdown.onValueChanged((value) => {
			this.wizard.model.publicIpName = (this._publicIpDropdown.value as azdata.CategoryValue).name;
		});

		this._publicIpNetworkText = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			placeHolder: localize('deployAzureSQLVM.NewPipPlaceholder', "Enter name for new public IP"),
			width: constants.standardWidth
		}).component();

		this._publicIpNetworkText.onTextChanged((e) => {
			this.wizard.model.publicIpName = e;
			this.activateRealTimeFormValidation();
		});

		this.wizard.changeComponentDisplay(this._publicIpNetworkText, 'none');

		this._publicIpFlexContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withItems(
			[this._publicIpDropdown, this._publicIpNetworkText, this._newPublicIpCheckbox]
		).component();

	}

	private async populatePublicIpkDropdown() {
		this._publicIpDropdown.loading = true;

		let publicIps = await this.getPips();

		if (!publicIps || publicIps.length === 0) {
			publicIps = [{
				displayName: 'None',
				name: 'None'
			}];
			this._publicIpDropdown.updateProperties({
				values: publicIps
			});
			this._newPublicIpCheckbox.checked = true;
			this._newPublicIpCheckbox.enabled = false;

			this.toggleNewPublicIp();
		} else {
			this._publicIpDropdown.updateProperties({
				values: publicIps
			});
			this._newPublicIpCheckbox.enabled = true;

			this.toggleNewPublicIp();
		}
		this._publicIpDropdown.loading = false;
	}

	private toggleNewPublicIp() {
		let newPip = this._newPublicIpCheckbox.checked!;

		this.wizard.model.newPublicIp = newPip ? 'True' : 'False';

		if (newPip) {
			this.wizard.changeComponentDisplay(this._publicIpDropdown, 'none');
			this.wizard.changeComponentDisplay(this._publicIpNetworkText, 'block');
			this.wizard.model.publicIpName = this._publicIpNetworkText.value!;
		} else {
			this.wizard.changeComponentDisplay(this._publicIpDropdown, 'block');
			this.wizard.changeComponentDisplay(this._publicIpNetworkText, 'none');
			this.wizard.model.publicIpName = (this._publicIpDropdown.value as azdata.CategoryValue).name;
		}
	}

	private async createVmRDPAllowCheckbox(view: azdata.ModelView) {
		this._vmRDPAllowCheckbox = view.modelBuilder.checkBox().withProperties({
			label: constants.RDPAllowCheckboxLabel,
		}).component();
		this._vmRDPAllowCheckbox.onChanged((value) => {
			this.wizard.model.allowRDP = (value) ? 'True' : 'False';
		});
		this.wizard.model.allowRDP = 'False';
	}


	public async getVirtualNetworks(): Promise<any> {
		let url = `https://management.azure.com` +
			`/subscriptions/${this.wizard.model.azureSubscription}` +
			`/providers/Microsoft.Network/virtualNetworks?api-version=2020-05-01`;

		let response = await this.wizard.getRequest(url);

		let dropdownValues = response.data.value.filter((value: any) => {
			return value.location === this.wizard.model.azureRegion;
		}).map((value: any) => {
			let resourceGroupName = value.id.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
			return {
				name: value.id,
				displayName: `${value.name} \t\t resource group: (${resourceGroupName})`
			};
		});
		return dropdownValues;
	}

	public async getSubnets(): Promise<any> {
		if (!this.wizard.model.virtualNetworkName) {
			return;
		}
		let url = `https://management.azure.com` +
			`${this.wizard.model.virtualNetworkName}` +
			`/subnets?api-version=2020-05-01`;
		let response = await this.wizard.getRequest(url);
		let dropdownValues = response.data.value.map((value: any) => {
			return {
				name: value.id,
				displayName: `${value.name}`
			};
		});
		return dropdownValues;
	}

	public async getPips(): Promise<any> {
		let url = `https://management.azure.com` +
			`/subscriptions/${this.wizard.model.azureSubscription}` +
			`/providers/Microsoft.Network/publicIPAddresses?api-version=2020-05-01`;
		let response = await this.wizard.getRequest(url);
		let dropdownValues = response.data.value.filter((value: any) => {
			return value.location === this.wizard.model.azureRegion;
		}).map((value: any) => {
			let resourceGroupName = value.id.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
			return {
				name: value.id,
				displayName: `${value.name} \t\t resource group: (${resourceGroupName})`
			};
		});
		return dropdownValues;
	}

	protected async validatePage(): Promise<string> {
		const errorMessages = [];
		if (this.wizard.model.newVirtualNetwork === 'True') {
			if (this.wizard.model.virtualNetworkName.length < 2 || this.wizard.model.virtualNetworkName.length > 64) {
				errorMessages.push(localize('deployAzureSQLVM.VnetNameLengthError', "Virtual Network name must be between 2 and 64 characters long"));
			}
		} else {
			if (this.wizard.model.virtualNetworkName === 'None') {
				errorMessages.push(localize('deployAzureSQLVM.NewVnetError', "Create a new virtual network"));
			}
		}

		if (this.wizard.model.newSubnet === 'True') {
			if (this.wizard.model.subnetName.length < 1 || this.wizard.model.virtualNetworkName.length > 80) {
				errorMessages.push(localize('deployAzureSQLVM.SubnetNameLengthError', "Subnet name must be between 1 and 80 characters long"));
			}
		} else {
			if (this.wizard.model.subnetName === 'None') {
				errorMessages.push(localize('deployAzureSQLVM.NewSubnetError', "Create a new sub network"));
			}
		}

		if (this.wizard.model.newPublicIp === 'True') {
			if (this.wizard.model.publicIpName.length < 1 || this.wizard.model.publicIpName.length > 80) {
				errorMessages.push(localize('deployAzureSQLVM.PipNameError', "Public IP name must be between 1 and 80 characters long"));
			}
		} else {
			if (this.wizard.model.publicIpName === 'None') {
				errorMessages.push(localize('deployAzureSQLVM.NewPipError', "Create a new new public Ip"));
			}
		}

		this.wizard.showErrorMessage(errorMessages.join('\n'));
		return errorMessages.join('\n');

	}
}