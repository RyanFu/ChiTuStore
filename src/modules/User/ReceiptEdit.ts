﻿import ko_val = require('knockout.validation');
import mapping = require('knockout.mapping');
import account = require('services/Account');
import site = require('Site');
import app = require('Application');

var province_none = { Name: '请选择省' };
var city_none = { Name: '请选择城市' };
var county_none = { Name: '请选择县' }
var validation;

class Receipt {
    Id = ko.observable<string>()
    Address = ko.observable<string>().extend({ required: true })
    CityId = ko.observable<string>().extend({ required: true })
    CountyId = ko.observable<string>().extend({ required: true })
    ProvinceId = ko.observable<string>().extend({ required: true })
    Mobile = ko.observable<string>().extend({
        required: true,
        validation: [{
            validator: function (value, params) {
                value = value || '';
                return value.length == 11 && /^1[34578]\d{9}$/.test(value);
            },
            message: '请输入正确的手机号码'
        }]
    })
    Name = ko.observable<string>().extend({ required: true })
    PostalCode = ko.observable<string>()
    Consignee = ko.observable<string>().extend({ required: true });

    IsDefault = ko.observable<boolean>(false)
    AreaCode = ko.observable()
    PhoneNumber = ko.observable()
    BranchNumber = ko.observable()
    Phone = ko.computed<string>({
        read: function () {
            var phone = '';
            var areaCode = $.trim(this.AreaCode());
            var phoneNumber = $.trim(this.PhoneNumber());
            var branchNumber = $.trim(this.BranchNumber());

            if (areaCode != '' && phoneNumber != '')
                phone = areaCode + '-' + phoneNumber;

            if (phone != '' && branchNumber != '')
                phone = phone + '-' + branchNumber;

            return phone == '' ? null : phone;
        },
        write: function (value) {
            /// <param name="value" type="String"/>
            if (value == null || value == '')
                return;

            var arr = value.split('-');
            this.AreaCode(arr[0]);
            this.PhoneNumber(arr[1]);
            this.BranchNumber(arr[2]);
        }
    }, this);
}


class Model {
    private page: chitu.Page

    constructor(page: chitu.Page) {
        this.page = page;
    }

    receipt = new Receipt()
    allowSelect = ko.observable(false)
    provinces = ko.observableArray()
    cities = ko.observableArray()
    counties = ko.observableArray()
    enableProvince = () => {
        //说明：不能使用 this.province
        this.province().removeAttr('disabled');
    }
    loadCities = (provinceId) => {
        /// <returns type="jQuery.Deferred"/>

        this.city().attr('disabled', 'disabled');
        this.county().attr('disabled', 'disabled');
        if (this.isEmptyId(provinceId))
            return $.Deferred().resolve();

        this.cities.removeAll();
        this.counties.removeAll();

        var result = account.getCities(provinceId).done((items) => {
            this.cities.push(city_none);
            for (var i = 0; i < items.length; i++) {
                this.cities.push(items[i]);
            }
            this.city().removeAttr('disabled');
        });

        return result;
    }
    loadCounties = (cityId) => {
        this.county().attr('disabled', 'disabled');
        if (this.isEmptyId(cityId))
            return $.Deferred().resolve();

        this.counties.removeAll();
        var result = account.getCounties(cityId).done((items) => {
            this.counties.push(county_none);
            for (var i = 0; i < items.length; i++) {
                this.counties.push(items[i]);
            }
            this.county().removeAttr('disabled');
        });
        return result;
    }
    saveReceipt = () => {
        validation = ko_val.group(this.receipt);
        if (!this.receipt['isValid']()) {
            validation.showAllMessages();
            return $.Deferred().reject();
        }

        return account.saveReceiptInfo(this.receipt).done(() => {
            //===========================================
            // 说明：触发加载事件，重新加载数据。
            var list_page = app.getPage('User.ReceiptList');
            if (list_page) {
                list_page.on_load({});
            }
            //===========================================

            app.back();
        });
    }

    isEmptyId = (id) => {
        return id == '' || id == null || id == '00000000-0000-0000-0000-000000000000';
    }
    //===================================================================
    // 说明：页面上的控件
    receiptNode = () => {
        return $(this.page.element).find('[name="Receipt"]')[0];
    }
    province = () => {
        return $(this.page.element).find('[name="Province"]');
    }
    city = () => {
        return $(this.page.element).find('[name="City"]');
    }
    county = () => {
        return $(this.page.element).find('[name="County"]');
    }
    //===================================================================
    // 说明：事件
    onProvinceChanged = () => {
        var provinceId = this.province().find('option:selected').val();
        var provinceName = this.province().find('option:selected').text();
        this.loadCities(provinceId);
        //this.receipt.ProvinceName(provinceName);
    }
    onCityChanged = () => {
        var cityId = this.city().find('option:selected').val();
        var cityName = this.city().find('option:selected').text();
        this.loadCounties(cityId);
        //this.receipt.CityName(cityName);
    }
    onCountyChanged = () => {
        var countyId = this.county().find('option:selected').val();
        var countyName = this.county().find('option:selected').text();
        //this.receipt.CountyName(countyName);
    }
}

class ReceiptEditPage extends chitu.Page {
    private model: Model;
    constructor(html) {
        super(html);
        let model = this.model = new Model(this);
        ko.applyBindings(model, this.element);

        account.getProvinces().done(function (provinces) {
            model.provinces.push(province_none);
            for (var i = 0; i < provinces.length; i++) {
                model.provinces.push(provinces[i]);
            }

        });

        this.load.add(this.page_load);
    }

    private page_load(sender: ReceiptEditPage, args) {

        if (!args.id) {
            var obj = mapping.toJS(new Receipt());
            mapping.fromJS(obj, {}, sender.model.receipt);
            return;
        }

        return account.getReceiptInfo(args.id).done(function (data) {
            mapping.fromJS(data, {}, sender.model.receipt);
            var receipt = sender.model.receipt;
            var provinceId = data.ProvinceId;
            var cityId = data.CityId;
            var countyId = data.CountyId;

            sender.model.enableProvince();
            return sender.model.loadCities(provinceId)
                .pipe(function () {
                    sender.model.receipt.CityId(cityId);
                    sender.model.onCityChanged();
                    return sender.model.loadCounties(cityId);
                })
                .done(function () {
                    sender.model.receipt.CountyId(countyId);
                    sender.model.onCountyChanged();
                })
        });
        //}
    }
}

export = ReceiptEditPage;

// function (page: chitu.Page) {
//     /// <param name="page" type="chitu.Page"/>

//     var model = new Model(page);
//     page.load.add(function (sender, args) {
//         /// args 参数说明：
//         /// 1. receipt:   编辑操作
//         /// 2. receipts:  添加操作

//         if (!args.id) {
//             var obj = mapping.toJS(new Receipt());
//             mapping.fromJS(obj, {}, model.receipt);
//             return;
//         }

//         return account.getReceiptInfo(args.id)
//             .done(function (data) {
//                 mapping.fromJS(data, {}, model.receipt);
//                 var receipt = model.receipt;
//                 var provinceId = data.ProvinceId;
//                 var cityId = data.CityId;
//                 var countyId = data.CountyId;

//                 model['receipts'] = args.receipts;

//                 model.enableProvince();
//                 return model.loadCities(provinceId).pipe(function () {
//                     model.receipt.CityId(cityId);
//                     model.onCityChanged();
//                     return model.loadCounties(cityId);
//                 })
//                     .done(function () {
//                         model.receipt.CountyId(countyId);
//                         model.onCountyChanged();
//                     })
//             });
//     })

//     page.viewChanged.add(() => ko.applyBindings(model, page.element));


//     return account.getProvinces().done(function (provinces) {
//         model.provinces.push(province_none);
//         for (var i = 0; i < provinces.length; i++) {
//             model.provinces.push(provinces[i]);
//         }

//     });

// } 